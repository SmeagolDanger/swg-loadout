/* ═══════════════════════════════════════════════════════════
   SWG Struct Templates — Maps IFF types to field definitions
   for on-the-fly GUI generation, similar to original SIE.
   ═══════════════════════════════════════════════════════════ */

import { BinaryReader } from './swgFiles';

/* ── Field type constants ── */
export const FIELD = {
  UINT8: 'uint8', INT8: 'int8',
  UINT16: 'uint16', INT16: 'int16',
  UINT32: 'uint32', INT32: 'int32',
  FLOAT: 'float', BOOL: 'bool',
  STRING: 'string', CSTRING: 'cstring',
  VEC3: 'vec3', VEC4: 'vec4',
  COLOR_ARGB: 'color_argb', COLOR_RGBA: 'color_rgba',
  CRC: 'crc', ENUM: 'enum',
  HEX8: 'hex8', HEX16: 'hex16', HEX32: 'hex32',
  UNICODE: 'unicode',
  TEMPLATE_PARAM: 'template_param',
};

/* ── Read a field value from a BinaryReader ── */
export function readField(r, type, meta) {
  if (r.remaining() <= 0) return { value: null, error: 'EOF' };
  try {
    switch (type) {
      case FIELD.UINT8:  return { value: r.readUint8() };
      case FIELD.INT8:   return { value: r.readInt8() };
      case FIELD.UINT16: return { value: r.readUint16BE() };
      case FIELD.INT16:  return { value: r.readInt16BE() };
      case FIELD.UINT32: return { value: r.readUint32BE() };
      case FIELD.INT32:  return { value: r.readInt32BE() };
      case FIELD.FLOAT:  return { value: r.readFloat32BE() };
      case FIELD.BOOL:   return { value: r.readUint8() !== 0 };
      case FIELD.CSTRING: return { value: r.readCString() };
      case FIELD.STRING: {
        const len = meta?.length || r.readUint16BE();
        return { value: r.readString(len) };
      }
      case FIELD.VEC3: return { value: r.readVec3BE() };
      case FIELD.VEC4: return { value: { x: r.readFloat32BE(), y: r.readFloat32BE(), z: r.readFloat32BE(), w: r.readFloat32BE() } };
      case FIELD.COLOR_ARGB: {
        const a = r.readUint8(), red = r.readUint8(), g = r.readUint8(), b = r.readUint8();
        return { value: { r: red, g, b, a }, display: `rgba(${red},${g},${b},${(a/255).toFixed(2)})` };
      }
      case FIELD.COLOR_RGBA: {
        const red = r.readUint8(), g = r.readUint8(), b = r.readUint8(), a = r.readUint8();
        return { value: { r: red, g, b, a }, display: `rgba(${red},${g},${b},${(a/255).toFixed(2)})` };
      }
      case FIELD.CRC:  return { value: r.readUint32BE(), display: '0x' + r.view.getUint32(r.pos - 4, false).toString(16).padStart(8, '0') };
      case FIELD.HEX8: return { value: r.readUint8(), display: '0x' + (r.bytes[r.pos - 1]).toString(16).padStart(2, '0') };
      case FIELD.HEX16: return { value: r.readUint16BE(), display: '0x' + r.view.getUint16(r.pos - 2, false).toString(16).padStart(4, '0') };
      case FIELD.HEX32: return { value: r.readUint32BE(), display: '0x' + r.view.getUint32(r.pos - 4, false).toString(16).padStart(8, '0') };
      case FIELD.ENUM: {
        const v = r.readInt32BE();
        const label = meta?.values?.[v] || String(v);
        return { value: v, display: label };
      }
      default: return { value: r.readUint8(), error: 'Unknown type: ' + type };
    }
  } catch (e) {
    return { value: null, error: e.message };
  }
}

/* ── SWG Template Parameter auto-parser ── */
export function parseTemplateParams(data) {
  const r = new BinaryReader(data);
  const results = [];
  let index = 0;

  while (r.remaining() > 0) {
    const startPos = r.tell();
    const loaded = r.readUint8();

    if (loaded === 0) {
      results.push({ index, loaded: false, type: 'unloaded' });
      index++;
      continue;
    }

    // Try to auto-detect parameter type by reading ahead
    const param = { index, loaded: true, offset: startPos };

    // Read type indicator byte
    if (r.remaining() < 1) break;
    const typeTag = r.readUint8();

    try {
      switch (typeTag) {
        case 0x00: // Integer parameter
          param.type = 'int';
          param.value = r.readInt32BE();
          break;
        case 0x01: // Float parameter
          param.type = 'float';
          param.value = r.readFloat32BE();
          break;
        case 0x02: // Bool
          param.type = 'bool';
          param.value = r.readUint8() !== 0;
          break;
        case 0x03: // String
          param.type = 'string';
          param.value = r.readCString();
          break;
        case 0x04: // StringId (file + name)
          param.type = 'stringId';
          param.file = r.readCString();
          param.name = r.readCString();
          param.value = param.file + ':' + param.name;
          break;
        case 0x05: // Vector
          param.type = 'vec3';
          param.value = r.readVec3BE();
          break;
        case 0x06: // Enum
          param.type = 'enum';
          param.value = r.readInt32BE();
          break;
        case 0x07: // Trigger volume
          param.type = 'trigger';
          param.radius = r.readFloat32BE();
          param.name = r.readCString();
          param.value = param.name + ' r=' + param.radius;
          break;
        default:
          // Unknown type, try to recover
          param.type = 'raw';
          param.typeTag = typeTag;
          param.value = '0x' + typeTag.toString(16);
          // Skip ahead carefully
          break;
      }
    } catch {
      param.type = 'error';
      param.value = 'Parse error at offset ' + startPos;
    }

    results.push(param);
    index++;
  }

  return results;
}

/* ═══════════════════════════════════════════════════════════
   Chunk template definitions by IFF FORM type + chunk tag.
   These map binary chunk data to named, typed fields.
   ═══════════════════════════════════════════════════════════ */
export const CHUNK_TEMPLATES = {
  /* ── Common chunks found in many IFF types ── */
  'DERV': { name: 'Derived Template', fields: [{ name: 'Parent Template', type: FIELD.CSTRING }] },
  'PCNT': { name: 'Parameter Count', fields: [{ name: 'Count', type: FIELD.UINT32 }] },

  /* ── Appearance Template ── */
  'APPR.EXBX.BOX ': {
    name: 'Extent Box', fields: [
      { name: 'Min X', type: FIELD.FLOAT }, { name: 'Min Y', type: FIELD.FLOAT }, { name: 'Min Z', type: FIELD.FLOAT },
      { name: 'Max X', type: FIELD.FLOAT }, { name: 'Max Y', type: FIELD.FLOAT }, { name: 'Max Z', type: FIELD.FLOAT },
    ]
  },
  'APPR.EXSP.SPHR': {
    name: 'Extent Sphere', fields: [
      { name: 'Center X', type: FIELD.FLOAT }, { name: 'Center Y', type: FIELD.FLOAT }, { name: 'Center Z', type: FIELD.FLOAT },
      { name: 'Radius', type: FIELD.FLOAT },
    ]
  },
  'SPS .CNT ': { name: 'Shader Primitive Count', fields: [{ name: 'Count', type: FIELD.UINT32 }] },
  'VTXA.INFO': {
    name: 'Vertex Array Info', fields: [
      { name: 'Format Flags', type: FIELD.HEX32 },
      { name: 'Vertex Count', type: FIELD.UINT32 },
    ]
  },
  'INDX.INFO': { name: 'Index Info', fields: [{ name: 'Index Count', type: FIELD.UINT32 }] },

  /* ── Object Templates ── */
  'SHOT.DRVD': { name: 'Derived Template', fields: [{ name: 'Parent', type: FIELD.CSTRING }] },

  /* ── Portal / Interior Layout ── */
  'PRTS': {
    name: 'Portal Info', fields: [
      { name: 'Portal Count', type: FIELD.UINT32 },
    ]
  },
  'PRTL': {
    name: 'Portal', fields: [
      { name: 'Geometry Index', type: FIELD.INT32 },
      { name: 'Clockwise', type: FIELD.BOOL },
      { name: 'Passable', type: FIELD.BOOL },
    ]
  },

  /* ── Shader ── */
  'EFCT': { name: 'Effect File', fields: [{ name: 'Effect Name', type: FIELD.CSTRING }] },
  'NAME': { name: 'Name', fields: [{ name: 'Value', type: FIELD.CSTRING }] },
  'TAG ': { name: 'Tag', fields: [{ name: 'Value', type: FIELD.CSTRING }] },

  /* ── Terrain ── */
  'MFAM': { name: 'Map Family', fields: [{ name: 'Family ID', type: FIELD.INT32 }, { name: 'Family Name', type: FIELD.CSTRING }] },
  'MGRP': { name: 'Map Group', fields: [{ name: 'Group ID', type: FIELD.INT32 }, { name: 'Group Name', type: FIELD.CSTRING }] },

  /* ── Appearance lookups ── */
  'APT .DATA': { name: 'Appearance Path Table', fields: [{ name: 'CRC', type: FIELD.CRC }, { name: 'Path', type: FIELD.CSTRING }] },

  /* ── Customization data ── */
  'CSTM': {
    name: 'Customization', fields: [
      { name: 'Variable Name', type: FIELD.CSTRING },
      { name: 'Value', type: FIELD.INT32 },
    ]
  },

  /* ── Client Data File ── */
  'CLDF.INFO': {
    name: 'Client Data Info', fields: [
      { name: 'Version', type: FIELD.UINT32 },
    ]
  },

  /* ── Slot descriptor ── */
  'SLOT': {
    name: 'Slot', fields: [
      { name: 'Slot Name', type: FIELD.CSTRING },
      { name: 'Hardpoint', type: FIELD.CSTRING },
    ]
  },

  /* ── Sound ── */
  'SNDS.DATA': { name: 'Sound Data', fields: [{ name: 'Sound File', type: FIELD.CSTRING }] },
};

/* ── Form-level descriptions ── */
export const FORM_DESCRIPTIONS = {
  'SHOT': 'Shared Object Template',
  'STOT': 'Shared Tangible Object Template',
  'SWOT': 'Shared Weapon Object Template',
  'SBOT': 'Shared Building Object Template',
  'SCOT': 'Shared Creature Object Template',
  'SIOT': 'Shared Installation Object Template',
  'SMOT': 'Shared Manufacture Schematic Template',
  'SVOT': 'Shared Vehicle Object Template',
  'SGOT': 'Shared Group Object Template',
  'SIMT': 'Shared Intangible Object Template',
  'SMSO': 'Server Manufacture Schematic Object',
  'SMAT': 'Shared Mission Object Template',
  'RCCT': 'Shared Resource Container Template',
  'MESH': 'Mesh Appearance',
  'DTII': 'Datatable (Integer)',
  'DTIIA': 'Datatable (Integer/Assoc)',
  'WSNP': 'World Snapshot',
  'PRTO': 'Portal Layout',
  'FLOR': 'Floor Mesh',
  'SPAM': 'Spatial Audio Map',
  'MLOD': 'Mesh Level of Detail',
  'CMPA': 'Component Appearance',
  'CSTB': 'Customization Data',
  'CSHD': 'Client Shader',
  'EFCT': 'Effect',
  'SST ': 'Skeleton Template',
  'SKTM': 'Skeleton Mesh',
  'CKAT': 'Animation',
  'APT ': 'Appearance Path Table',
  'SND ': 'Sound',
  'PAL ': 'Palette',
  'FOOT': 'Footprint',
  'SDSC': 'Slot Descriptor',
};

/* ── Try to match a template for a chunk ── */
export function getChunkTemplate(chunkTag, parentFormType, ancestorPath) {
  // Try specific path first
  const pathKey = ancestorPath + '.' + chunkTag;
  for (const key of Object.keys(CHUNK_TEMPLATES)) {
    if (pathKey.endsWith(key)) return CHUNK_TEMPLATES[key];
  }
  // Try parent.chunk
  const parentKey = (parentFormType || '').trim() + '.' + chunkTag.trim();
  if (CHUNK_TEMPLATES[parentKey]) return CHUNK_TEMPLATES[parentKey];
  // Try chunk tag alone
  if (CHUNK_TEMPLATES[chunkTag]) return CHUNK_TEMPLATES[chunkTag];
  if (CHUNK_TEMPLATES[chunkTag.trim()]) return CHUNK_TEMPLATES[chunkTag.trim()];
  return null;
}

/* ── Parse a chunk using its template ── */
export function parseChunkWithTemplate(data, template) {
  if (!template || !template.fields || !data) return null;
  const r = new BinaryReader(data);
  const values = [];
  for (const field of template.fields) {
    if (r.remaining() <= 0) break;
    const result = readField(r, field.type, field.meta);
    values.push({ ...field, ...result });
  }
  // Include remaining bytes info
  const remainingBytes = r.remaining();
  return { fields: values, remainingBytes, templateName: template.name };
}

/* ── Auto-detect data patterns when no template exists ── */
export function autoDetectFields(data) {
  if (!data || data.length === 0) return [];
  const fields = [];
  const r = new BinaryReader(data);

  // Heuristic: try to detect if it's a single null-terminated string
  let allPrintable = true;
  let nullIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) { nullIdx = i; break; }
    if (data[i] < 32 || data[i] > 126) { allPrintable = false; break; }
  }
  if (allPrintable && nullIdx > 0 && nullIdx >= data.length - 2) {
    fields.push({ name: 'String Value', type: 'auto', value: r.readCString(), display: null });
    return fields;
  }

  // Try to detect numeric fields
  if (data.length === 1) {
    fields.push({ name: 'Value', type: FIELD.UINT8, value: data[0], display: data[0] + ' (0x' + data[0].toString(16) + ')' });
  } else if (data.length === 2) {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    fields.push({ name: 'Value (uint16 BE)', type: FIELD.UINT16, value: v.getUint16(0, false) });
  } else if (data.length === 4) {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const u32 = v.getUint32(0, false);
    const f32 = v.getFloat32(0, false);
    fields.push({ name: 'As uint32', type: FIELD.UINT32, value: u32, display: u32 + ' (0x' + u32.toString(16).padStart(8, '0') + ')' });
    if (Number.isFinite(f32) && Math.abs(f32) < 1e10 && Math.abs(f32) > 1e-10) {
      fields.push({ name: 'As float', type: FIELD.FLOAT, value: f32 });
    }
  } else if (data.length === 12) {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const vec = { x: v.getFloat32(0, false), y: v.getFloat32(4, false), z: v.getFloat32(8, false) };
    if ([vec.x, vec.y, vec.z].every(n => Number.isFinite(n) && Math.abs(n) < 1e8)) {
      fields.push({ name: 'As Vector3', type: FIELD.VEC3, value: vec });
    }
  }

  return fields;
}

/* ── Format a parsed field value for display ── */
export function formatFieldValue(field) {
  if (field.display) return field.display;
  if (field.error) return '⚠ ' + field.error;
  if (field.value == null) return '(null)';

  const v = field.value;
  switch (field.type) {
    case FIELD.BOOL: return v ? 'true' : 'false';
    case FIELD.FLOAT: return typeof v === 'number' ? v.toFixed(6) : String(v);
    case FIELD.VEC3: return `(${v.x?.toFixed(3)}, ${v.y?.toFixed(3)}, ${v.z?.toFixed(3)})`;
    case FIELD.VEC4: return `(${v.x?.toFixed(3)}, ${v.y?.toFixed(3)}, ${v.z?.toFixed(3)}, ${v.w?.toFixed(3)})`;
    case FIELD.CRC:
    case FIELD.HEX32: return '0x' + (v >>> 0).toString(16).padStart(8, '0');
    case FIELD.HEX16: return '0x' + (v & 0xffff).toString(16).padStart(4, '0');
    case FIELD.HEX8: return '0x' + (v & 0xff).toString(16).padStart(2, '0');
    case FIELD.COLOR_ARGB:
    case FIELD.COLOR_RGBA: return `rgba(${v.r},${v.g},${v.b},${(v.a/255).toFixed(2)})`;
    default: return String(v);
  }
}

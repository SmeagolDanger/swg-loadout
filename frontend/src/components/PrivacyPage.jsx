import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="panel space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display tracking-wider text-hull-50">Privacy Policy</h1>
          <p className="mt-2 text-sm sm:text-base text-hull-200">
            This site is still under active development. That means the privacy practices here are intended to be
            simple, limited, and boring in the good way, not magical in the bad way.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-display tracking-wide text-plasma-300">What account data we store</h2>
          <p className="text-hull-200">
            If you create an account or sign in with Discord, the site may store your username, display name, email
            address if provided, account role, and basic authentication metadata needed to keep your account working.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-display tracking-wide text-plasma-300">What app data we store</h2>
          <p className="text-hull-200">
            The site stores the content you create or manage in the app, such as loadouts, components, collections,
            mods, and other related records required for the tools to function.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-display tracking-wide text-plasma-300">Cookies and sessions</h2>
          <p className="text-hull-200">
            The site uses a secure session cookie to keep you signed in. This cookie is used for authentication and
            basic account session management. It is not intended for advertising or cross-site tracking.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-display tracking-wide text-plasma-300">Logs and diagnostics</h2>
          <p className="text-hull-200">
            Server logs and diagnostics may capture limited technical information such as request paths, timestamps,
            error details, and basic device or browser metadata to help keep the site running and debug problems.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-display tracking-wide text-plasma-300">Third-party services</h2>
          <p className="text-hull-200">
            Some features may rely on third-party services such as Discord for login, email delivery providers for
            password reset emails, and infrastructure or monitoring services used to host and maintain the site.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-display tracking-wide text-plasma-300">Data sharing</h2>
          <p className="text-hull-200">
            This site is not intended to sell personal data. Information is only shared with service providers when
            needed to operate the app, deliver email, secure the service, or comply with legal requirements.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-display tracking-wide text-plasma-300">Contact and changes</h2>
          <p className="text-hull-200">
            Because this project is still evolving, this page may change as the app changes. If a feature or data flow
            becomes more complicated, this policy should be updated to reflect it.
          </p>
        </section>
      </div>
    </div>
  );
}

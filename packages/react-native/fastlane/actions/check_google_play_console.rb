# frozen_string_literal: true

module Fastlane
  module Actions
    # Verifies Google Play Console access by reading the latest track version code.
    class CheckGooglePlayConsoleAction < Action
      def self.run(params)
        Actions.lane_context[:PLATFORM_NAME] = :android
        pkg, creds = parse_params(params)
        track = params[:track] || 'internal'

        latest = other_action.ipc_wrapper(
          event_name: "Fetching Google Play #{track} track version code for #{pkg}",
          end_event_name: "Google Play #{track} track version code retrieved",
          action: -> { fetch_latest_version(pkg, track, creds) },
          end_payload_proc: ->(version_code) {
            { list: [{ package_name: pkg, track: track, version_code: version_code.to_s }] }
          }
        )

        { package_name: pkg, track: track, version_code: latest, credentials_path: creds }
      end

      def self.parse_params(params)
        pkg = params[:package_name] || default_config[:app_identifier]
        creds = params[:credentials_path] || default_config[:play_store_credentials_path]

        UI.user_error!('package_name is missing!') if pkg.to_s.strip.empty?
        [pkg, creds]
      end

      def self.fetch_latest_version(package_name, track, credentials_path)
        codes = other_action.google_play_track_version_codes(
          package_name: package_name,
          track: track,
          json_key: credentials_path
        )
        codes.empty? ? 0 : codes.first
      rescue StandardError => e
        handle_api_error(package_name, e)
      end

      def self.handle_api_error(package_name, error)
        msg = error.message.to_s.downcase
        if msg.include?('not found') || msg.include?('package not found') || msg.include?('404')
          create_url = 'https://play.google.com/console/developers/app/create-new-app'
          other_action.ipc_client(
            event_name: "App '#{package_name}' not found on Google Play Console",
            payload: {
              end: true,
              list: [
                { 'Status' => 'Not Found', 'Package' => package_name },
                { 'Action' => 'Create draft at', 'URL' => create_url }
              ]
            }
          )
          UI.error("\n❌ App '#{package_name}' was not found on Google Play Console!")
          UI.important('👉 Please create the app draft first in Google Play Console (takes ~1 min):')
          UI.important("   #{create_url}\n")
          UI.user_error!("App '#{package_name}' not found on Google Play Console! Create draft at: #{create_url}")
        end

        raise error
      end

      def self.default_config
        @default_config ||= other_action.setup(export_method: 'aab')[:config]
      end

      def self.description
        'Resolves the latest Google Play track version code to verify Google Play Console access'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :package_name,
            description: 'Package name / Application ID to check in Google Play Console',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :track,
            description: 'Google Play track to inspect (e.g. internal, alpha, beta, production)',
            optional: true,
            default_value: 'internal',
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :credentials_path,
            description: 'Path to Google Play Store credentials JSON file',
            optional: true,
            type: String
          )
        ]
      end

      def self.return_value
        'Latest Google Play track version info for the current Android app'
      end

      def self.authors
        ['tumerorkun']
      end

      def self.is_supported?(platform)
        platform == :android
      end
    end
  end
end

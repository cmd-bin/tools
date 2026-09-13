# frozen_string_literal: true

module Fastlane
  module Actions
    # Verifies Google Play Console access by reading the latest track version code.
    class CheckGooglePlayConsoleAction < Action
      def self.run(params)
        Actions.lane_context[:PLATFORM_NAME] = :android

        result = other_action.setup(export_method: 'aab')
        config = result[:config]

        package_name = params[:package_name] || config[:app_identifier]
        if package_name.to_s.strip.empty?
          UI.user_error!('package_name or APP_IDENTIFIER is missing! Please provide it in build.gradle, .env.deploy or pass package_name:com.example.app')
        end

        track = params[:track] || 'internal'

        other_action.ipc_client(
          event_name: "Fetching Google Play #{track} track version code for #{package_name}",
          payload: { start: true }
        )

        version_codes = other_action.google_play_track_version_codes(
          package_name: package_name,
          track: track,
          json_key: config[:play_store_credentials_path]
        )

        latest_version_code = version_codes.empty? ? 0 : version_codes.first

        other_action.ipc_client(
          event_name: "Google Play #{track} track version code retrieved",
          payload: {
            end: true,
            list: [
              {
                package_name: package_name,
                track: track,
                version_code: latest_version_code.to_s
              }
            ]
          }
        )

        {
          package_name: package_name,
          track: track,
          version_code: latest_version_code,
          credentials_path: config[:play_store_credentials_path]
        }
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
          )
        ]
      end

      def self.return_value
        'Latest Google Play track version info for the current Android app'
      end

      def self.authors
        ['tumerorkun']
      end

      # Fastlane action API requires `is_supported?`.
      def self.is_supported?(platform)
        platform == :android
      end
      # rubocop:enable Naming/PredicatePrefix
    end
  end
end

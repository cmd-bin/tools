# frozen_string_literal: true

module Fastlane
  module Actions
    # Registers a new Apple device in the Developer Portal.
    class AddDeviceAction < Action
      def self.run(params)
        Actions.lane_context[:PLATFORM_NAME] ||= :ios

        result = other_action.setup(export_method: 'app-store', run_match: false)
        config = result[:config]
        other_action.ipc_client(event_name: "Adding Device", payload: { start: true })
        other_action.register_device(
          name: params[:device_name],
          udid: params[:udid],
          api_key: result[:api_key],
          team_id: config[:team_id],
          username: config[:match_username]
        )
        other_action.ipc_client(event_name: "Added Device", payload: { end: true })
      end

      def self.description
        'Registers an Apple device using the configured Fastlane portal credentials'
      end

      # Fastlane action API requires `available_options`.
      # rubocop:disable Metrics/MethodLength
      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :device_name,
            optional: false,
            type: String,
            description: 'Device name to register'
          ),
          FastlaneCore::ConfigItem.new(
            key: :udid,
            optional: false,
            type: String,
            description: 'Device UDID to register'
          )
        ]
      end
      # rubocop:enable Metrics/MethodLength

      def self.return_value
        'The result of the register_device action'
      end

      def self.authors
        ['tumerorkun']
      end

      # Fastlane action API requires `is_supported?`.
      # rubocop:disable Naming/PredicatePrefix
      def self.is_supported?(platform)
        platform == :ios
      end
      # rubocop:enable Naming/PredicatePrefix
    end
  end
end

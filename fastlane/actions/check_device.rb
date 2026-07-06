# frozen_string_literal: true

module Fastlane
  module Actions
    # Checks Apple Developer devices by UDID or lists all registered devices.
    class CheckDeviceAction < Action
      def self.run(params)
        Actions.lane_context[:PLATFORM_NAME] ||= :ios
        other_action.setup(export_method: 'app-store', run_match: false)
        other_action.ipc_client(event_name: 'Getting Apple Developer devices', payload: { start: true })
        devices = Spaceship::ConnectAPI::Device.all
        udid = params[:udid].to_s
        other_action.ipc_client(event_name: 'Apple Developer devices retrieved', payload: { end: true, list: devices.map do |d|
          { status: d.status, model: d.model, class: d.deviceClass, name: d.name, udid: d.udid, addedDate: d.addedDate }
        end })
        return list_devices(devices) if udid.empty?

        device = devices.find { |existing_device| existing_device.udid == udid }

        print_output(params, device)

        device
      end

      def self.description
        'Checks a registered Apple device by UDID or lists all registered devices'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :udid,
            optional: true,
            type: String,
            description: 'Specific device UDID to look up'
          )
        ]
      end

      def self.return_value
        'The matched device object, or an array of device hashes when listing all devices'
      end

      def self.authors
        ['tumerorkun']
      end

      # Fastlane action API requires `is_supported?`.
      def self.is_supported?(platform)
        platform == :ios
      end
      # rubocop:enable Naming/PredicatePrefix

      def self.list_devices(devices)
        devices.each do |device|
          UI.message("UDID: #{device.udid} | NAME: #{device.name} | STATUS: #{device.status}")
        end

        devices
      end

      def self.print_output(params, device)
        if device
          UI.message("UDID: #{device.udid} | NAME: #{device.name} | STATUS: #{device.status}")
          return
        end

        UI.error("No device found with UDID: #{params[:udid]}")
      end
    end
  end
end

require 'socket'
require 'json'

module Fastlane
  module Actions
    class IpcClientAction < Action
      def self.run(params)
        socket_path = params[:socket_path]
        event_name = params[:event_name]
        payload = params[:payload] || {}

        return unless socket_path && File.exist?(socket_path)

        begin
          UNIXSocket.open(socket_path) do |socket|
            message = { event: event_name, payload: payload }.to_json
            socket.puts(message)
          end
        rescue StandardError => e
          # Silently fail so we don't break the build if IPC fails
        end
      end

      def self.description
        "Sends IPC events via UNIX Socket"
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :socket_path,
                                       env_name: "NF_IPC_SOCKET",
                                       description: "Path to the UNIX socket",
                                       optional: true,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :event_name,
                                       description: "Name of the event to send",
                                       optional: false,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :payload,
                                       description: "Payload object for the event",
                                       optional: true,
                                       is_string: false,
                                       default_value: {})
        ]
      end

      def self.authors
        ["tumerorkun"]
      end

      def self.step_text
        nil
      end

      def self.is_supported?(platform)
        true
      end
    end
  end
end

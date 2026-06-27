module Fastlane
  module Actions
    class IpcWrapperAction < Action
      def self.run(params)
        event_name = params[:event_name]
        end_event_name = params[:end_event_name] || event_name
        payload = params[:payload] || {}
        action_proc = params[:action]
        end_payload_proc = params[:end_payload_proc]

        # Başlangıç olayı için payload oluştur ve gönder
        start_payload = payload.dup
        start_payload[:start] = true
        other_action.ipc_client(event_name: event_name, payload: start_payload)

        result = nil
        begin
          if action_proc
            result = action_proc.call
          elsif block_given?
            result = yield
          end
        ensure
          # İşlem bittiğinde (hata alsa bile) bitiş olayını gönder
          end_payload = payload.dup
          end_payload[:end] = true

          if end_payload_proc && result
            begin
              dynamic_payload = end_payload_proc.call(result)
              end_payload.merge!(dynamic_payload) if dynamic_payload.is_a?(Hash)
            rescue => e
              UI.error("Error in end_payload_proc: #{e.message}")
            end
          end

          other_action.ipc_client(event_name: end_event_name, payload: end_payload)
        end

        return result
      end

      def self.description
        "Wraps an action block/proc with IPC start and end events"
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :event_name,
                                       description: "Name of the event",
                                       optional: false,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :end_event_name,
                                       description: "Optional name of the end event (defaults to event_name)",
                                       optional: true,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :payload,
                                       description: "Payload for the event",
                                       optional: true,
                                       is_string: false,
                                       default_value: {}),
          FastlaneCore::ConfigItem.new(key: :action,
                                       description: "The function/proc to execute",
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :end_payload_proc,
                                       description: "Optional proc that takes the block result and returns a hash to merge into the end event payload",
                                       optional: true,
                                       is_string: false,
                                       type: Proc)
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

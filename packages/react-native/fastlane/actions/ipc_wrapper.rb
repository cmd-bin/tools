# frozen_string_literal: true

module Fastlane
  module Actions
    class IpcWrapperAction < Action
      def self.run(params)
        event_name = params[:event_name]
        payload = params[:payload] || {}
        action_proc = params[:action]
        end_payload_proc = params[:end_payload_proc]

        # Send simple informational message event
        other_action.ipc_client(event_name: event_name, payload: payload)

        result = nil
        begin
          if action_proc
            result = action_proc.call
          elsif block_given?
            result = yield
          end
        ensure
          if params[:end_event_name]
            end_payload = {}
            if end_payload_proc && result
              begin
                dynamic_payload = end_payload_proc.call(result)
                if dynamic_payload.is_a?(Hash)
                  if dynamic_payload.key?(:list) || dynamic_payload.key?('list')
                    end_payload = payload.merge(dynamic_payload)
                  elsif dynamic_payload.key?(:meta) || dynamic_payload.key?('meta')
                    end_payload = payload.merge(dynamic_payload)
                  else
                    end_payload = payload.merge({ meta: dynamic_payload })
                  end
                end
              rescue StandardError => e
                UI.error("Error in end_payload_proc: #{e.message}")
              end
            end
            other_action.ipc_client(event_name: params[:end_event_name], payload: end_payload)
          end
        end

        result
      end

      def self.description
        'Executes an action block and sends IPC message event'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :event_name,
                                       description: 'Name of the event message',
                                       optional: false,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :end_event_name,
                                       description: 'Optional name of the end event (defaults to event_name)',
                                       optional: true,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :payload,
                                       description: 'Payload for the event',
                                       optional: true,
                                       is_string: false,
                                       default_value: {}),
          FastlaneCore::ConfigItem.new(key: :action,
                                       description: 'The function/proc to execute',
                                       optional: true,
                                       is_string: false,
                                       type: Proc),
          FastlaneCore::ConfigItem.new(key: :end_payload_proc,
                                       description: 'Proc to extract and send metadata from block result',
                                       optional: true,
                                       is_string: false,
                                       type: Proc)
        ]
      end

      def self.authors
        ['tumerorkun']
      end

      def self.step_text
        nil
      end

      def self.is_supported?(_platform)
        true
      end
    end
  end
end

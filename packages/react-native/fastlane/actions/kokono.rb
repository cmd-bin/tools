# frozen_string_literal: true

require 'fastlane/action'
require 'fastlane_core'
require 'shellwords'

module Fastlane
  module Actions
    class KokonoAction < Action
      def self.run(params)
        token = params[:token] || ENV.fetch('KOKONO_CONNECTION_TOKEN', nil)
        fail_on_error = params[:fail_on_error]

        # Return immediately if token is not available - do not trigger IPC events
        if token.to_s.strip.empty?
          if fail_on_error
            UI.user_error!('KOKONO_CONNECTION_TOKEN is not set.')
          else
            UI.important('KOKONO_CONNECTION_TOKEN is not set, skipping Kokono notification.')
            return nil
          end
        end

        token = token.to_s.strip
        e2e = (params[:e2e] || ENV.fetch('KOKONO_CONNECTION_E2E', nil)).to_s.strip
        title = params[:title]
        message = params[:message]

        # Kokono CLI requires both title and message when e2e encryption is enabled
        unless e2e.empty?
          title = 'Notification' if title.to_s.strip.empty?
          message = title if message.to_s.strip.empty?
        end

        cmd = ['npx', '-y', '@cmd-bin/kokono']
        cmd << '--token' << Shellwords.escape(token)
        cmd << '--title' << Shellwords.escape(title) if title && !title.to_s.strip.empty?
        cmd << '--message' << Shellwords.escape(message) if message && !message.to_s.strip.empty?
        cmd << '--e2e' << Shellwords.escape(e2e) unless e2e.empty?

        event_name = params[:event_name] || 'Sending Release Notification'
        end_event_name = params[:end_event_name] || 'Sent Release Notification'
        payload = params[:payload] || {}

        other_action.ipc_wrapper(
          event_name: event_name,
          end_event_name: end_event_name,
          payload: payload,
          action: -> {
            begin
              Actions.sh(cmd.join(' '), log: false)
              UI.success('✅ Kokono notification sent successfully!')
              true
            rescue StandardError => e
              if fail_on_error
                UI.user_error!("Failed to send KokoNo notification: #{e.message}")
              else
                UI.error("Failed to send KokoNo notification: #{e.message}")
                false
              end
            end
          }
        )
      end

      def self.description
        'Send notifications via KokoNo CLI'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(
            key: :token,
            env_name: 'KOKONO_CONNECTION_TOKEN',
            description: 'Authentication token for KokoNo',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :title,
            description: 'Notification title',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :message,
            description: 'Notification message',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :e2e,
            env_name: 'KOKONO_CONNECTION_E2E',
            description: 'End-to-End Encryption public key',
            optional: true,
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :event_name,
            description: 'IPC event name for starting notification',
            optional: true,
            default_value: 'Sending Release Notification',
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :end_event_name,
            description: 'IPC event name for completed notification',
            optional: true,
            default_value: 'Sent Release Notification',
            type: String
          ),
          FastlaneCore::ConfigItem.new(
            key: :payload,
            description: 'Optional IPC payload hash (e.g. { id: 5 })',
            optional: true,
            is_string: false,
            default_value: {},
            type: Hash
          ),
          FastlaneCore::ConfigItem.new(
            key: :fail_on_error,
            description: 'Whether to raise an error if sending notification fails',
            optional: true,
            is_string: false,
            default_value: false,
            type: Boolean
          )
        ]
      end

      def self.example_code
        [
          'kokono(
            title: "Build Successful",
            message: "v1.0.0 (42) has been uploaded to TestFlight."
          )',
          'kokono(
            token: "custom_token",
            title: "Release Alert",
            message: "Android APK build completed.",
            e2e: "public_key_base64"
          )'
        ]
      end

      def self.authors
        ['tumerorkun']
      end

      def self.is_supported?(_platform)
        true
      end
    end
  end
end

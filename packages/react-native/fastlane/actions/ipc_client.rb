# frozen_string_literal: true

require 'socket'
require 'json'

module Fastlane
  module Actions
    class IpcClientAction < Action
      @socket = nil
      @socket_path = nil

      def self.run(params)
        socket_path = params[:socket_path] || ENV.fetch('NF_IPC_SOCKET', nil)
        event_name = params[:event_name]
        payload = (params[:payload] || {}).dup

        return unless socket_path && File.exist?(socket_path)

        # Attach active pipeline step if present in environment
        if ENV['FASTLANE_PIPELINE_STEP'] && !payload.key?(:step)
          payload[:step] = ENV['FASTLANE_PIPELINE_STEP']
        end

        message = { event: event_name, payload: payload }
        send_message(socket_path, message)
      end

      def self.send_message(socket_path, message_hash)
        json_line = "#{message_hash.to_json}\n"
        ensure_socket(socket_path)
        return unless @socket

        begin
          @socket.puts(json_line)
          @socket.flush
        rescue Errno::EPIPE, IOError, Errno::ECONNRESET
          # Socket disconnected; attempt reconnect and retry once
          close_socket
          ensure_socket(socket_path)
          begin
            if @socket
              @socket.puts(json_line)
              @socket.flush
            end
          rescue StandardError
            close_socket
          end
        rescue StandardError
          # Silently fail so we don't break the build if IPC fails
        end
      end

      def self.ensure_socket(socket_path)
        return if @socket && !@socket.closed? && @socket_path == socket_path

        close_socket
        begin
          @socket = UNIXSocket.open(socket_path)
          @socket.sync = true
          @socket_path = socket_path
        rescue StandardError
          @socket = nil
          @socket_path = nil
        end
      end

      def self.close_socket
        begin
          @socket&.close unless @socket&.closed?
        rescue StandardError
          # Ignore close errors
        ensure
          @socket = nil
          @socket_path = nil
        end
      end

      def self.description
        'Sends IPC events via UNIX Socket'
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :socket_path,
                                       env_name: 'NF_IPC_SOCKET',
                                       description: 'Path to the UNIX socket',
                                       optional: true,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :event_name,
                                       description: 'Name of the event to send',
                                       optional: false,
                                       type: String),
          FastlaneCore::ConfigItem.new(key: :payload,
                                       description: 'Payload object for the event',
                                       optional: true,
                                       is_string: false,
                                       default_value: {})
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

at_exit do
  Fastlane::Actions::IpcClientAction.close_socket
end

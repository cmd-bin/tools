require 'socket'
require 'json'

module IpcClient
  def self.send_event(event_name, payload = {})
    socket_path = ENV['NF_IPC_SOCKET']

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
end

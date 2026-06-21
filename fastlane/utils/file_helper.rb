# frozen_string_literal: true

require 'base64'
require 'dotenv'
require 'fileutils'

module FileHelper
  FILE_PERMISSION = 0400

  def self.decode_base64(base64_content)
    Base64.decode64(base64_content)
  end

  # Decodes a base64 string and writes the result to a file
  def self.decode_base64_to_file(base64_content, file_path)
    if base64_content.nil? || file_path.nil?
      Fastlane::UI.message("Skipping decode: base64_content or file_path is nil")
      return
    end

    FileUtils.mkdir_p(File.dirname(file_path))
    File.delete(file_path) if File.exist?(file_path)
    File.write(file_path, decode_base64(base64_content))
    File.chmod(FILE_PERMISSION, file_path)
  end

  def self.zip_folder(output_path: '', input_dir_path: '')
    Fastlane::UI.user_error!("Input directory does not exist: #{input_dir_path}") unless File.directory?(input_dir_path)

    FileUtils.mkdir_p(File.dirname(output_path))
    FileUtils.rm_f(output_path)

    Dir.chdir(File.dirname(input_dir_path)) do
      folder_name = File.basename(input_dir_path)
      Fastlane::Actions.sh("zip -r #{output_path} #{folder_name}")
    end

    Fastlane::UI.message("Zipped #{input_dir_path} -> #{output_path}")
    output_path
  end

  def self.read_env(env_path: nil)
    env_path = File.expand_path('../../.env', __dir__) if env_path.nil?
    Fastlane::UI.user_error!("Env file does not exist: #{env_path}") unless File.exist?(env_path)

    Dotenv.overload(env_path)
  end
end
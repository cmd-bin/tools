# frozen_string_literal: true

module ConfigHelper
  MATCH_TYPE_MAP = {
    'ad-hoc' => 'adhoc',
    'app-store' => 'appstore'
  }.freeze

  # Fetches a required ENV variable or raises a Fastlane error
  def self.require_env(key)
    ENV.fetch(key) { Fastlane::UI.user_error!("#{key} is missing!") }
  end

  # Fetches an optional ENV variable, logs a warning and returns default if missing
  def self.optional_env(key, default: nil)
    result = ENV.fetch(key) { default }

    # Treat empty strings as missing and return default
    return default if result.nil? || (result.is_a?(String) && result.strip.empty?)

    # Safely convert string values "true" and "false" into actual Ruby booleans
    if result.is_a?(String)
      return true if result.strip.downcase == 'true'
      return false if result.strip.downcase == 'false'
    end

    result
  end

  # Walks up from a given directory to find the nearest .tool-versions,
  # returns the directory containing it (project root).
  def self.find_project_root(start_dir)
    dir = File.expand_path(start_dir)
    loop do
      return dir if File.exist?(File.join(dir, '.tool-versions'))

      parent = File.dirname(dir)
      Fastlane::UI.user_error!("Could not find .tool-versions in any parent directory of #{start_dir}") if parent == dir
      dir = parent
    end
  end

  def self.find_ios_project_name(ios_dir)
    xcworkspace = Dir.glob(File.join(ios_dir, '*.xcworkspace')).first
    return File.basename(xcworkspace, '.xcworkspace') if xcworkspace

    xcodeproj = Dir.glob(File.join(ios_dir, '*.xcodeproj')).first
    return File.basename(xcodeproj, '.xcodeproj') if xcodeproj

    nil
  end

  def self.find_ios_scheme(ios_dir, workspace_name)
    return nil unless workspace_name

    project_path = File.join(ios_dir, "#{workspace_name}.xcodeproj")
    unless File.exist?(project_path)
      project_path = Dir.glob(File.join(ios_dir, '*.xcodeproj')).first
      return workspace_name unless project_path
    end

    begin
      require 'xcodeproj'
      schemes = Xcodeproj::Project.schemes(project_path)
      return schemes.first unless schemes.empty?
    rescue LoadError, StandardError => e
      Fastlane::UI.important("Failed to read schemes using xcodeproj: #{e.message}")
    end

    File.basename(project_path, '.xcodeproj')
  end

  def self.common_config
    return @_common_config if @_common_config

    app_identifier                  = require_env('APP_IDENTIFIER')
    root_dir_name                   = optional_env('GITHUB_WORKSPACE', default: nil)
    root_dir_name ||= find_project_root(File.dirname(__FILE__))
    slack_url                       = optional_env('SLACK_URL', default: nil)
    slack_mentions                  = optional_env('SLACK_MENTIONS', default: '')
    firebase_credentials_base64     = optional_env('FIREBASE_CREDENTIALS', default: nil)
    firebase_tester_group           = optional_env('FIREBASE_TESTER_GROUP', default: 'internal')
    build_environment               = if optional_env('BUILD_ENVIRONMENT',
                                                      default: 'production') == 'production'
                                        'Prod'
                                      else
                                        'Dev'
                                      end
    build_configuration             = optional_env('BUILD_CONFIGURATION', default: 'Release')
    keep_outputs                    = optional_env('KEEP_OUTPUTS', default: false)
    output_path                     = File.join(Dir.home, '.cmd-bin', 'react-native', 'lane-outputs')
    private_keys_path               = "#{output_path}/private_keys"
    derived_data_path               = File.join(Dir.home, '.cmd-bin', 'react-native', 'ios', 'derived-data')
    key_filepath                    = "#{private_keys_path}/private_key.p8"
    firebase_credentials_path       = "#{private_keys_path}/firebase_credentials.json"
    key_store_path                  = "#{private_keys_path}/key.keystore"
    play_store_credentials_path     = "#{private_keys_path}/play_store_credentials.json"

    @_common_config = {
      cliff: true,
      app_configuration: build_configuration,
      build_environment: build_environment,
      slack_url: slack_url,
      slack_mentions: slack_mentions,
      app_identifier: app_identifier,
      root_dir_name: root_dir_name,
      firebase_credentials_base64: firebase_credentials_base64,
      firebase_tester_group: firebase_tester_group,
      output_path: output_path,
      key_filepath: key_filepath,
      derived_data_path: derived_data_path,
      firebase_credentials_path: firebase_credentials_path,
      key_store_path: key_store_path,
      play_store_credentials_path: play_store_credentials_path,
      keep_outputs: keep_outputs,
      private_keys_path: private_keys_path,
      cleanup_paths: [
        key_filepath,
        firebase_credentials_path,
        key_store_path,
        play_store_credentials_path
      ]
    }
    @_common_config
  end

  def self.ios_config(export_method: 'app-store', is_ci: true)
    platform                        = :ios
    commons                         = common_config()
    root_dir_name                   = commons[:root_dir_name]

    workspace_name                  = optional_env('WORKSPACE_NAME',
                                                   default: find_ios_project_name("#{root_dir_name}/ios"))
    scheme                          = optional_env('SCHEME',
                                                   default: find_ios_scheme("#{root_dir_name}/ios", workspace_name))
    team_id                         = require_env('APPLE_DEVELOPER_PORTAL_TEAM_ID')
    itc_team_id                     = require_env('APPLE_STORE_CONNECT_TEAM_ID')
    key_base64                      = require_env('APPLE_KEY')
    key_id                          = require_env('APPLE_KEY_ID')
    issuer_id                       = require_env('APPLE_ISSUER_ID')

    match_git_url                   = require_env('MATCH_REPO_URL')
    match_username                  = require_env('MATCH_REPO_USERNAME')
    match_password                  = require_env('MATCH_PASSWORD')
    match_readonly                  = optional_env('MATCH_READONLY', default: is_ci)
    match_git_branch                = optional_env('MATCH_REPO_BRANCH', default: 'master')
    match_git_private_key_base64    = require_env('MATCH_REPO_PRIVATE_KEY')

    firebase_app_id                 = require_env('FIREBASE_IOS_APP_ID')
    silent                          = optional_env('SILENT', default: true)
    send_changelog_to_testflight    = optional_env('SEND_CHANGELOG_TO_TESTFLIGHT', default: false)

    FileHelper.decode_base64_to_file(
      key_base64,
      commons[:key_filepath]
    )

    {
      **commons,
      configuration: commons[:app_configuration],
      export_method: export_method,
      platform: platform,
      match_type: MATCH_TYPE_MAP[export_method] || export_method,
      in_house: false,
      workspace_name: workspace_name,
      workspace: "#{root_dir_name}/ios/#{workspace_name}.xcworkspace",
      project: "#{root_dir_name}/ios/#{workspace_name}.xcodeproj",
      lane_output_directory: "#{commons[:output_path]}/#{platform}",
      xcarchive_path: "#{commons[:output_path]}/#{platform}/archive/Archive.xcarchive",
      ipa_output_directory: "#{commons[:output_path]}/#{platform}/output/",
      zip_asset_path: "#{commons[:output_path]}/tmp/#{platform}/app.zip",
      derived_data_path: commons[:derived_data_path],
      scheme: scheme,
      team_id: team_id,
      itc_team_id: itc_team_id,
      key_base64: key_base64,
      key_filepath: commons[:key_filepath],
      key_id: key_id,
      issuer_id: issuer_id,
      match_git_url: match_git_url,
      match_username: match_username,
      match_readonly: match_readonly,
      match_password: match_password,
      match_git_branch: match_git_branch,
      match_git_private_key_base64: match_git_private_key_base64,
      firebase_app_id: firebase_app_id,
      silent: silent,
      send_changelog_to_testflight: send_changelog_to_testflight
    }
  end

  def self.android_config(export_method: 'apk')
    platform                        = :android
    commons                         = common_config()
    root_dir_name                   = commons[:root_dir_name]

    key_store_base64                = require_env('ANDROID_KEYSTORE')
    key_store_password              = require_env('ANDROID_KEYSTORE_PASSWORD')
    key_alias                       = require_env('ANDROID_KEY_ALIAS')
    key_password                    = require_env('ANDROID_KEY_PASSWORD')
    firebase_app_id                 = require_env('FIREBASE_ANDROID_APP_ID')
    play_store_credentials_base64   = optional_env('PLAY_STORE_CREDENTIALS')
    play_store_track                = optional_env('PLAY_STORE_TRACK', default: 'internal')
    play_store_release_status       = optional_env('PLAY_STORE_RELEASE_STATUS', default: 'draft')

    FileHelper.decode_base64_to_file(
      key_store_base64,
      commons[:key_store_path]
    )
    FileHelper.decode_base64_to_file(
      play_store_credentials_base64,
      commons[:play_store_credentials_path]
    )

    {
      **commons,
      export_method: export_method,
      platform: platform,
      task: export_method == 'apk' ? 'assemble' : 'bundle',
      build_type: commons[:app_configuration],
      project_dir: "#{root_dir_name}/android",
      gradle_path: "#{root_dir_name}/android/gradlew",
      app_gradle_file_path: "#{root_dir_name}/android/app/build.gradle",
      key_store_base64: key_store_base64,
      key_store_password: key_store_password,
      key_alias: key_alias,
      key_password: key_password,
      firebase_app_id: firebase_app_id,
      play_store_credentials_base64: play_store_credentials_base64,
      play_store_track: play_store_track,
      play_store_release_status: play_store_release_status,
      zip_asset_path: "#{commons[:output_path]}/tmp/#{platform}/app.zip"
    }
  end

  def self.platform_config(platform: :ios, export_method: 'app-store', is_ci: true)
    return @_platform_config if @_platform_config

    case platform
    when :ios
      @_platform_config = ios_config(export_method: export_method, is_ci: is_ci)
    when :android
      @_platform_config = android_config(export_method: export_method)
    else
      Fastlane::UI.user_error!("Unsupported platform: #{platform}")
    end

    @_platform_config
  end
end

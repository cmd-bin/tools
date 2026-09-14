# frozen_string_literal: true

module Steps
  module Common
    def common_prepare_firebase_tester_group(ctx)
      FileHelper.decode_base64_to_file(
        ctx[:firebase_credentials_base64],
        ctx[:firebase_credentials_path]
      )

      ensure_firebase_tester_group(
        groups: ctx[:firebase_tester_group],
        app: ctx[:firebase_app_id],
        service_credentials_file: ctx[:firebase_credentials_path]
      )
    end

    def common_postbuild(ctx, platform:)
      input_dir = if platform == :ios
                    ctx[:lane_output_directory]
                  elsif ctx[:export_method] == 'apk'
                    File.dirname(ctx[:apk_path])
                  else
                    File.dirname(ctx[:aab_path])
                  end

      FileHelper.zip_folder(
        input_dir_path: input_dir,
        output_path: ctx[:zip_asset_path]
      )

      if ENV.fetch('GITHUB_ENV', nil)
        File.open(ENV.fetch('GITHUB_ENV', nil), 'a') do |f|
          f.puts("RELEASE_ASSET_PATH=#{ctx[:zip_asset_path]}")
        end
      end

      version = ctx[:version] || ctx[:version_name]
      build_number = ctx[:build_number] || ctx[:new_build_number]

      release_notes = GithubHelper.release_notes(
        cliff: ctx[:cliff],
        platform: platform,
        version: version,
        build_number: build_number,
        build_environment: ctx[:build_environment]
      )

      { release_notes: release_notes }
    end

    def common_prerelease(ctx, platform:)
      version = ctx[:version] || ctx[:version_name]
      build_number = ctx[:build_number] || ctx[:new_build_number]
      github_release = nil

      if ENV.fetch('GITHUB_TOKEN', nil) && !ENV.fetch('GITHUB_TOKEN', nil).empty?
        github_release = ipc_wrapper(
          event_name: 'Creating Github Release',
          end_event_name: 'Created Github Release',
          action: -> {
            GithubHelper.create_release(
              platform: platform,
              build_environment: ctx[:build_environment],
              version: version,
              build_number: build_number,
              release_notes: ctx[:release_notes],
              upload_assets: [ctx[:zip_asset_path]]
            )
          },
          end_payload_proc: ->(res) { { url: res['html_url'] } }
        )
      end

      { github_release: github_release }
    end

    def common_release_firebase(ctx, platform:)
      github_release = ctx[:github_release]
      release_notes = ctx[:release_notes].dup
      release_notes << "\n" unless release_notes.empty?
      release_notes << "\nGithub Release(#{github_release['id']}): #{github_release['html_url']}" if github_release

      params = {
        app: ctx[:firebase_app_id],
        service_credentials_file: ctx[:firebase_credentials_path],
        groups: ctx[:firebase_tester_group],
        release_notes: release_notes
      }

      if platform == :ios
        params[:ipa_path] = ctx.dig(:ipa_result, :path)
      elsif ctx[:export_method] == 'apk'
        params[:android_artifact_type] = 'APK'
        params[:android_artifact_path] = ctx[:apk_path]
      else
        params[:android_artifact_type] = 'AAB'
        params[:android_artifact_path] = ctx[:aab_path]
      end

      firebase_result = ipc_wrapper(
        event_name: 'Uploading to Firebase App Distribution',
        end_event_name: 'Uploaded to Firebase App Distribution',
        action: -> { firebase_app_distribution(params) },
        end_payload_proc: ->(res) {
          {
            download: res[:binaryDownloadUri],
            console: res[:firebaseConsoleUri],
            testing: res[:testingUri],
            createdAt: res[:createTime],
            updatedAt: res[:updateTime],
            expireAt: res[:expireTime],
            version: "#{res[:displayVersion]}(#{res[:buildVersion]})"
          }
        }
      )

      { firebase_result: firebase_result }
    end

    def common_postrelease(ctx, platform:, destination:)
      clean_build_artifacts if ENV.fetch('CI', nil)
      emoji = platform == :ios ? '🍏' : '🤖'
      version = ctx[:version] || ctx[:version_name]
      build_number = ctx[:build_number] || ctx[:new_build_number]

      kokono(
        title: "#{emoji} #{ctx[:app_name]} v#{version} (#{build_number})",
        message: "Has been uploaded to #{destination}."
      )
    end
  end
end

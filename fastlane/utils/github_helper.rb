# frozen_string_literal: true

require 'net/http'
require 'uri'
require 'json'

module GithubHelper
  GITHUB_API_BASE = "https://api.github.com"
  REPO_PATTERN    = %r{github\.com[:/](.+?)(\.git)?$}

  def self.current_branch
    ENV['GITHUB_REF_NAME'] ||
    Fastlane::Actions.sh("git rev-parse --abbrev-ref HEAD").strip
  end

  def self.current_repo
    return ENV['GITHUB_REPOSITORY'] if ENV['GITHUB_REPOSITORY']

    url = Fastlane::Actions.sh("git config --get remote.origin.url").strip
    return Regexp.last_match(1) if url =~ REPO_PATTERN

    Fastlane::UI.user_error!("Repository name could not be determined")
  end

  def self.release_notes(cliff: false, platform: :ios, version: '0.0.1', build_number: 0, build_environment: 'Dev')
    if cliff
      tag_name = "#{platform == :ios ? '🍏' : '🤖'}-v#{version}_#{build_number}_#{build_environment.downcase}"
      Fastlane::Actions.sh("cd #{ENV['GITHUB_WORKSPACE']} && RUST_LOG=error git cliff --tag=#{tag_name} --unreleased -o #{ENV['GITHUB_WORKSPACE']}/release_notes.md")
      notes = File.read("#{ENV['GITHUB_WORKSPACE']}/release_notes.md")
      # IpcClient.send_event("Created release notes", { notes: notes })
      return notes
    else
      params = {
        state: "closed",
        base: current_branch,
        sort: "updated",
        direction: "desc",
        per_page: 1000
      }

      data = github_get("/repos/#{current_repo}/pulls", params)

      notes = data.map { |pr| "\n#{pr['title']} - ##{pr['number']} - @#{pr['user']['login']}" }.join
      # IpcClient.send_event("Created release notes", { notes: notes })
      return notes
    end
  end

  def self.create_release(platform: :ios, version: '0.0.1', build_number: 0, release_notes: '', upload_assets: [], build_environment: 'Dev')
    Fastlane::Actions::SetGithubReleaseAction.run(
      server_url: GITHUB_API_BASE,
      repository_name: current_repo,
      api_bearer: ENV["GITHUB_TOKEN"],
      name: "#{platform == :ios ? '🍏' : '🤖'} v#{version} (#{build_number}) #{build_environment}",
      tag_name: "#{platform == :ios ? '🍏' : '🤖'}-v#{version}_#{build_number}_#{build_environment.downcase}",
      description: release_notes,
      commitish: current_branch,
      upload_assets: upload_assets,
      is_draft: false,
      is_prerelease: false,
      is_generate_release_notes: false,
    )
  end

  # Performs authenticated GET request to GitHub API
  def self.github_get(path, params = {})
    uri       = URI("#{GITHUB_API_BASE}#{path}")
    uri.query = URI.encode_www_form(params) unless params.empty?
    token     = ENV['GITHUB_TOKEN']

    request = Net::HTTP::Get.new(uri)
    request["Accept"]        = "application/vnd.github+json"
    request["User-Agent"]    = "fastlane"
    request["Authorization"] = "Bearer #{token}" if token && !token.empty?

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(request) }

    unless response.code.to_i == 200
      Fastlane::UI.user_error!("GitHub API error #{response.code}: #{response.body}")
    end

    JSON.parse(response.body)
  end

  private_class_method :github_get
end
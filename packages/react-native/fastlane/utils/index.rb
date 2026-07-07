# frozen_string_literal: true

# Automatically loads all .rb files in this directory (except itself)
Dir[File.expand_path('**/*.rb', __dir__)].reject { |f| f == __FILE__ }.sort.each do |file|
  require file
end

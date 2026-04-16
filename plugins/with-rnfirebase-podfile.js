const { withDangerousMod } = require("@expo/config-plugins");

const fs = require("fs");
const path = require("path");

const withRNFirebasePodfile = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, "utf-8");

        if (!podfileContent.includes("use_frameworks!")) {
          podfileContent = "use_frameworks!\n\n" + podfileContent;
          fs.writeFileSync(podfilePath, podfileContent);
        }
      }

      return config;
    },
  ]);
};

module.exports = withRNFirebasePodfile;

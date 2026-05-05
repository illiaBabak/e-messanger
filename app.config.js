export default {
  expo: {
    name: "e-messanger",
    slug: "e-messanger",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "emessanger",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.emessanger.app",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [

              "633288838470-2dii3bj0pqhpc5067lmh96ac3e7pqh6q.apps.googleusercontent.com"
            ]
          }
        ]
      }
    },
    android: {
      googleServicesFile: "./google-services.json",
      package: "com.emessanger.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#4A90FF",
          dark: {
            backgroundColor: "#4A90FF"
          }
        }
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-google-signin/google-signin",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
            forceStaticLinking: [
              "RNFBApp",
              "RNFBAuth",
              "RNFBFirestore"
            ]
          }
        }
      ],
      "expo-audio",
      [
        "expo-media-library",
        {
          "photosPermission": "Allow e-messanger to access your photos.",
          "savePhotosPermission": "Allow e-messanger to save photos.",
          "isAccessMediaLocationEnabled": true
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow e-messanger to access your photos.",
          "cameraPermission": "Allow e-messanger to access your camera."
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      webClientId: process.env.WEB_CLIENT_ID,
      iosClientId: process.env.IOS_CLIENT_ID
    }
  }
}

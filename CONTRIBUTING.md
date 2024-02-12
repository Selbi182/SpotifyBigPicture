# Contributing to SpotifyBigPicture
You want to help out? That's cool! Here's a small collection of info to help you get started. Remember, PRs are always open, and if you need help you can always DM me on Discord: `selbi`

## Setup Project
Here's a basic rundown on how to set up the development environment:

1. Make sure you have Java 11 SDK or newer installed and properly configured (path variables etc.)
2. Clone the project from master and open it with your favorite IDE
3. Put a valid `spotifybot.properties` file in the root directory of the cloned project (if you've used the app privately before, you can simply copy-paste the one you already got)
4. Run the project through `gradle bootRun` (or use the included Gradle Wrapper if you don't have Gradle installed yourself, e.g. `./gradlew bootRun`). For reference, the _main_ function is located under `java/spotify/SpotifyBigPicture.java`

And that should be it! The app will be available under http://localhost:8183 by default.


## Development Tools
By adding `?dev` to the URL, you'll unlock development mode for the client-side view. This unlocks a new category of developer tools to the very bottom of the "Show All Settings" tab and also enables some anomaly checks (visible in the web console).

## Navigating the Source Code
I'll be blunt, the code is a bit of a mess to navigate right now. I'll try my best to summarize how everything is stitched together:
### Backend (Java)
The Java side of the app is responsible for fetching the actual song data from the Spotify API, determining the most dominant colors of artworks, fetching the lyrics from Genius, etc. Basically, anything that has to do with data.

**A rundown of the three most important files:**

* `PlaybackController.java` is where all the REST endpoints are that are called by the frontend
* `PlaybackInfoProvider.java` is where all the heavy lifting for fetching the Spotify API happens, as well as assembling all the data in the format the frontend expects
* `ContextProvider.java` is responsible for keeping track of the current playback context (e.g. the current album/playlist/whatever the user is listening to). The main purpose of this file is to detect whether the context has changed, to avoid bombarding the Spotify API with useless requests

Of course, everything else is also working in tandem with this stuff, but this should get you started.

### Frontend (JavaScript/HTML/CSS)
You'll find the root HTML file under `resources/static/layout.html` and the main CSS class under `resources/static/design/style.css`.

As for JavaScript, the only file you'll need to worry about is `resources/static/js/spotify-big-picture.js`. _Everything_ is in this one file. At the time of writing, that's almost 4000 lines. I apologize, but I simply didn't get around to splitting the project into more sensible files yet, heh.

The JS file is basically broken down into two huge sections: the upper half takes care of all the actual logic, the lower half is where all the settings are defined.

<hr>

## Settings / Visual Preferences
SpotifyBigPicture is highly customizable through its settings (aka. Visual Preferences) and you can create your own too easily!

## Guide: How to Add a New Setting
Let's create a new setting to help you understand how things work!

Settings are defined under the `Preferences & Presets Data` section in the lower half of the main JavaScript file.

### Step 1: Create Base Setting
Before you do anything else, you need to choose a _unique_ ID for your setting. The ID must not collide with any other one and must be Kebab Case (i.e. lower-case-and-concatenated-by-hyphens).

Next go to `Preferences & Presets Data`, decide where in the settings list you want your new setting to appear, and insert a new block for it there. Here's a minimum template you can use:
```
 {
    id: "my-cool-setting",
    name: "My Cool Setting",
    description: "If enabled, cool things will happen",
    category: "General",
    default: true,
},
```

### Step 2: Adding Logic
If you did everything right and reload the app now, you'll already see your fancy new setting in the settings menu. But of course, it doesn't do anything yet, so let's add some logic!

There are two main control schemes for the logic:

#### Using `css`:
This block controls CSS classes to be added/removed to specific elements, depending on whether the setting is enabled. Very handy, as many settings basically boil down to changing some basic CSS stuff.

The format is pretty straight forward:
```
    css: {
        "elem-id": "some-css-class",
        "some-other-elem": "!some-other-css-class"
    },
```
Each entry maps one HTML element (via IDs, like if you were using JavaScript's _getElementById_) to one CSS class. If the setting is enabled, the class is added to the element's class list, and vice-versa. You can have as many entries as you'd like, but only one class can be affected per element.

Putting an exclamation mark `!` in front of the class name inverts the logic for that specific entry, so the class is added when the feature is _disabled_ and removed again when it's turned on.

The actual design aspect has to be handled by the CSS stylesheet, of course, so I won't dive into that here. The stylesheet is located under: `resources/static/design/style.css`

#### Using `callback`:
In cases where simply changing a bit of CSS isn't enough, _callbacks_ come in handy. These allow you to run custom JavaScript code whenever a setting is toggled:
```
    callback: (state) => {
      if (state) {
        // do stuff when setting has been enabled
      } else {
        // do other stuff when setting has been disabled
      }
    },
```
`state` is a boolean set to true if the setting has been enabled. If you don't care about the state and just want to run the same code whenever the setting has been toggled (like to refresh the tracklist for example), you can simply omit it like this:
```
    callback: () => {
      console.log("Setting has been toggled");
    },
```

**Note:** Callbacks also get called when the website is opened or refreshed! Make sure you keep this in mind to avoid any conflicts.

### (Optional) Step 3: Further Setting Features
Your setting is basically ready for shipment! But there are a few more things you might want to keep in mind when creating settings.

#### Protection:
If you want to avoid the state of the setting to revert to its default state whenever you change presets, you can do so by adding the following field:
```
    protected: true,
```
Doing this will make the setting's default state _only_ kick into effect when starting the app for the very first time or resetting all settings.

#### Overriding:
Having your new settings be completely detached from anything else and doing its own thing is nice, easy to handle, and the ideal case. However, you may have noticed that some settings are always grayed-out in the settings menu. These settings have been "overridden", meaning changing their state will have no effect. This is necessary, as there are plenty of settings that either depend on one another to be enabled as well, or take priority over another setting for one reason or another.

There are two ways to do this:

* `requiredFor`: Used to mark other settings as dependent on this one, i.e. if this one is currently _disabled_, the settings in the array will be grayed out
* `overrides`: Basically the inversion of _requiredFor_; if this setting is currently _enabled_, the ones in the array will be grayed out 

For both fields, an array of strings with the IDs you want to target is used. Here's an example with both:

```
    requiredFor: ["some-other-setting-id", "yet-anothersetting-id"],
    overrides: ["wow-look-another-setting-id"],
```

Do note that no logic is actually run to identify or prevent overridden settings from doing anything, it's all just for visual flair to aid the user, so they don't scratch their heads wondering why toggling a specific setting appears to not do anything. If you mess up elsewhere, the setting will still work just as usual, even when it's grayed-out in the settings menu!

#### Subcategory Header:
This will add a header above this setting in the settings menu (such as _Main Content > Release_). The header has _no_ consistency checks and is basically fake, so keep that in mind; it's only for visual flair!

```
    subcategoryHeader: "My Cool General Settings",
```

### Settings Summary
Congratulations, you have learned everything there is to creating new settings! Here's the full template from this guide for your convenience and reference:

```
 {
    id: "my-cool-setting",
    name: "My Cool Setting",
    description: "If enabled, cool things will happen",
    category: "General",
    default: true,
    protected: false,
    css: {
        "elem-id": "some-css-class",
        "some-other-elem": "!some-other-css-class"
    },
    callback: (state) => {
      if (state) {
        // do stuff when setting has been enabled
      } else {
        // do other stuff when setting has been disabled
      }
    },
    requiredFor: ["some-other-setting-id", "yet-anothersetting-id"],
    overrides: ["wow-look-another-setting-id"],
    subcategoryHeader: "My Cool General Settings"
},
```

And here's a basic summary of every field in a setting:

* `id` (required): the setting's unique identifier; must not collide with another one and must be Kebab Case (i.e. lower-case-and-concatenated-by-hyphens)
* `name` (required): the setting's name; doesn't need to be unique
* `description` (required): the description that appears at the bottom right in the settings menu when you mouse-over the setting
* `category` (required): the category the setting will be located under (must match the category's name _exactly_; see the list of categories under `PREFERENCES_CATEGORY_ORDER`)
* `default` (optional): the default state of this setting (enabled/disabled); absence implies _false_
* `protected` (optional): if set to true, protects the setting from being changed when changing presets ("unaffected"); absence implies _false_

* `css` (logic): adds or removes CSS class names to the specified HTML IDs depending on whether the setting is enabled or disabled
* `callback` (logic): runs custom JavaScript code whenever the setting is toggled and once during startup

* `requiredFor` (optional): an array of settings IDs as strings; used to mark other settings as dependent on this one (i.e. if this one is currently _disabled_, the listed settings will be grayed out)
* `overrides` (optional): basically the inversion of _requiredFor_; if this setting is currently _enabled_, the listed ones will be grayed out
* `subcategoryHeader` (optional): adds an extra subcategory text in the options menu above the setting; omit if you don't want one
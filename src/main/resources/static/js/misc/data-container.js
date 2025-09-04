/**
 * @typedef {Object} CurrentData
 * @property {string} type
 * @property {number} deployTime
 * @property {number} versionId
 * @property {Array<{device: string, baseDb: number}>} customVolumeSettings
 * @property {Array<string>} settingsToToggle
 * @property {{
 *    id: string,
 *    artists: Array<string>,
 *    title: string,
 *    description: string,
 *    album: string,
 *    releaseDate: string,
 *    discNumber: number,
 *    trackNumber: number,
 *    timeCurrent: number,
 *    timeTotal: number,
 *    imageData: {
 *      imageUrl: string,
 *      imageUrlHD: string,
 *      imageColors: {
 *        averageBrightness: number,
 *        primary: {r: number, g: number, b: number},
 *        secondary: {r: number, g: number, b: number}
 *      }
 *    }
 * }} currentlyPlaying
 * @property {{
 *    discNumber: number,
 *    totalDiscCount: number,
 *    trackCount: number,
 *    combinedTime: number,
 *    listTracks: Array<any>,
 *    queue: Array<any>,
 *    trackListView: string,
 *    nextImageData: {
 *      imageUrl: string,
 *      imageUrlHD: string,
 *      imageColors: {
 *        averageBrightness: number,
 *        primary: {r: number, g: number, b: number},
 *        secondary: {r: number, g: number, b: number}
 *      }
 *    }
 * }} trackData
 * @property {{
 *    context: {contextName: string, contextType: string, contextDescription: string},
 *    device: string,
 *    paused: boolean,
 *    repeat: string,
 *    shuffle: boolean,
 *    volume: number,
 *    thumbnailUrl: string
 * }} playbackContext
 */
const currentData = {
  type: "",
  deployTime: 0,
  versionId: 0,
  customVolumeSettings: [
    {
      device: "",
      baseDb: 0
    }
  ],
  settingsToToggle: [],
  currentlyPlaying: {
    id: "",
    artists: [],
    title: "",
    description: "",
    album: "",
    releaseDate: "",
    discNumber: 0,
    trackNumber: 0,
    timeCurrent: 0,
    timeTotal: 0,
    imageData: {
      imageUrl: "",
      imageUrlHD: "",
      imageColors: {
        averageBrightness: 0.0,
        primary: {
          r: 0,
          g: 0,
          b: 0
        },
        secondary: {
          r: 0,
          g: 0,
          b: 0
        }
      }
    }
  },
  trackData: {
    discNumber: 0,
    totalDiscCount: 0,
    trackCount: 0,
    combinedTime: 0,
    listTracks: [],
    queue: [],
    trackListView: "",
    nextImageData: {
      imageUrl: "",
      imageUrlHD: "",
      imageColors: {
        averageBrightness: 0.0,
        primary: {
          r: 0,
          g: 0,
          b: 0
        },
        secondary: {
          r: 0,
          g: 0,
          b: 0
        }
      }
    }
  },
  playbackContext: {
    context: {
      contextName: "",
      contextType: "",
      contextDescription: ""
    },
    device: "",
    paused: "",
    repeat: "",
    shuffle: "",
    volume: -1,
    thumbnailUrl: ""
  }
};

function updateCurrentData(changes) {
  for (let prop in changes) {
    currentData[prop] = changes[prop];
  }
}
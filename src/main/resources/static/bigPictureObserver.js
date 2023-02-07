// Big Picture Observer
//  To be used in combination with Spicetify extensions to directly tell
//  the interface that there has been an update (observer pattern)

let bigPictureObserverData = {
  context_uri: "",
  duration: 0,
  is_paused: false,
  repeating_context: false,
  repeating_track: false,
  shuffling_context: false,
  position_as_of_timestamp: 0,
  session_id: "",
  track_uri: "",
  queue_revision: ""
}

setTimeout(() => {
  setInterval(() => {
    let playerData = Spicetify.Player.data;
    let queueRevision = "_state" in Spicetify.Player.origin._queue
        ? Spicetify.Player.origin._queue._state.queueRevision
        : Spicetify.Player.origin._queue._queue.queueRevision;
    if (updateObserverDataAndCheckForUpdates(playerData, queueRevision)) {
      fetch("https://player.selbi.club/update")
          .then(result => console.log(result));
    }
  }, 100);

  Spicetify.Player.addEventListener("songchange", () => {
    updateObserverDataAndCheckForUpdates();
  });

  function updateObserverDataAndCheckForUpdates(playerData, queueRevision) {
    let changes = false;
    if (playerData && queueRevision) {
      changes = changes | update("context_uri", playerData.context_uri);
      changes = changes | update("duration", playerData.duration);
      changes = changes | update("is_paused", playerData.is_paused);
      changes = changes | update("repeating_context", playerData.options.repeating_context);
      changes = changes | update("repeating_track", playerData.options.repeating_track);
      changes = changes | update("shuffling_context", playerData.options.shuffling_context);
      changes = changes | update("position_as_of_timestamp", playerData.position_as_of_timestamp);
      changes = changes | update("session_id", playerData.session_id);
      changes = changes | update("track_uri", playerData.track.uri);
      changes = changes | update("queue_revision", queueRevision);
    }
    return changes;
  }

  function update(target, newData) {
    if (bigPictureObserverData[target] !== newData) {
      bigPictureObserverData[target] = newData;
      return true;
    }
    return false;
  }
}, 1000);

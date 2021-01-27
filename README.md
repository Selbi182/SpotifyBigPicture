![Banner](https://i.imgur.com/MkS2cLj.png)

# Spotify Playback Info

A Spring Boot–based bot that automatically checks for your currently played Song on Spotify and displays it in a beautiful fullscreen browser page!

## Some Examples

![Rammstein - Mein Herz brennt](https://i.imgur.com/gQheXCj.png)

![Deafheaven - Dream House](https://i.imgur.com/A4x3Y1J.png)

![Finsterforst - Ecce Homo](https://i.imgur.com/YMc16jt.png)

## Note

This bot is in *very* early development stages and probably not 100% stable yet. The biggest problem is getting a reliable `EventSource` stream, since many servers will eventually kill it after some time, regardless of any potential heartbeats trying to keep it alive.
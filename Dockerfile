FROM adoptopenjdk/openjdk11:alpine AS build
WORKDIR /app
COPY . /app
RUN chmod +x /app/gradlew && /app/gradlew bootJar

FROM adoptopenjdk/openjdk11:alpine
COPY --from=build /app/build/libs/SpotifyBigPicture.jar /app/SpotifyBigPicture.jar
CMD ["java", "-jar", "/app/SpotifyBigPicture.jar"]
FROM openjdk:11 AS build
WORKDIR /app
COPY . /app
RUN chmod +x /app/gradlew && /app/gradlew bootJar

FROM openjdk:11
COPY --from=build /app/build/libs/SpotifyBigPicture.jar /app/SpotifyBigPicture.jar
CMD ["java", "-jar", "/app/SpotifyBigPicture.jar"]
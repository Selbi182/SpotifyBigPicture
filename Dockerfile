FROM openjdk:11-jre AS build
WORKDIR /app
COPY . /app
RUN chmod +x /app/gradlew && /app/gradlew bootJar

FROM openjdk:11-jre
COPY --from=build /app/build/libs/SpotifyBigPicture.jar /app/SpotifyBigPicture.jar
CMD ["java", "-jar", "/app/SpotifyBigPicture.jar"]
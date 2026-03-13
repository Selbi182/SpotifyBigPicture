FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app
COPY . .
RUN chmod +x /app/gradlew && /app/gradlew bootJar

FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app
COPY --from=build /app/build/libs/SpotifyBigPicture.jar /app/SpotifyBigPicture.jar
CMD ["java", "-jar", "/app/SpotifyBigPicture.jar"]

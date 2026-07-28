# 1. 빌드 단계 (Java 21 기준)
FROM gradle:8.7-jdk21 AS build
WORKDIR /app
COPY . .
RUN ./gradlew build -x test --no-daemon

# 2. 실행 단계 (Java 21 실행 환경)
FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
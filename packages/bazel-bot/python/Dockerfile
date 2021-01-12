# build with
# docker build -t bazel-bot-python .
FROM python:3.8

RUN apt-get update
RUN apt-get install -y \
    zip \
    build-essential \
    python-dev \
    python3-dev \
    openjdk-11-jdk

# Installing bazel as per https://docs.bazel.build/versions/3.7.0/install-ubuntu.html
RUN curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > bazel.gpg
RUN mv bazel.gpg /etc/apt/trusted.gpg.d/
RUN echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list
RUN apt-get update && apt-get install -y bazel

WORKDIR /home/bazel-bot
RUN git clone https://github.com/googleapis/googleapis.git
WORKDIR /home/bazel-bot/googleapis
# Build once and cache the result even if it fails.
RUN bazel build ...; exit 0
# Build again to quickly see any error.
RUN bazel build ...

ENTRYPOINT [ "/bin/bash" ]
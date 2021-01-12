# build with
# docker build -t bazel-bot-java .

FROM openjdk:8-jdk

RUN apt update

# Bazel  https://docs.bazel.build/versions/master/install-ubuntu.html#install-on-ubuntu
RUN apt install -y curl gnupg
RUN curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > bazel.gpg
RUN mv bazel.gpg /etc/apt/trusted.gpg.d/
RUN echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list
RUN apt update
RUN apt install -y bazel

# Bazel requires zip and python.
RUN apt-get install -y zip python3 python3-distutils python3-apt

# Git
RUN apt-get install -y git

# googleapis/googleapis
WORKDIR /home/bazel-bot
RUN git clone https://github.com/googleapis/googleapis.git
WORKDIR /home/bazel-bot/googleapis

RUN bazel build -k ...; exit 0

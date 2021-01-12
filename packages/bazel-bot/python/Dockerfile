# build with
# docker build -t bazel-bot-python .

FROM python:3.8.3

RUN apt update

# Bazel  https://docs.bazel.build/versions/master/install-ubuntu.html#install-on-ubuntu
RUN apt install -y curl gnupg
RUN curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > bazel.gpg
RUN mv bazel.gpg /etc/apt/trusted.gpg.d/
RUN echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list
RUN apt update
RUN apt install -y bazel

# bazel requires zip.
RUN apt-get install zip

# Git
RUN apt-get install -y git

# googleapis/googleapis
WORKDIR /home/bazel-bot
RUN git clone https://github.com/googleapis/googleapis.git
WORKDIR /home/bazel-bot/googleapis

RUN bazel build -k ...; exit 0

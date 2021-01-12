# build with
# docker build -t bazel-bot .

# FROM ubuntu:18.04
# FROM python:3.8.3
FROM openjdk:8-jdk

RUN apt update

# Bazel  https://docs.bazel.build/versions/master/install-ubuntu.html#install-on-ubuntu
RUN apt install -y curl gnupg
RUN curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > bazel.gpg
RUN mv bazel.gpg /etc/apt/trusted.gpg.d/
RUN echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list
RUN apt update
RUN apt install -y bazel

# Git
RUN apt-get install -y git

##################### Install pyenv
RUN apt-get install -y make build-essential libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev libncursesw5-dev \
    xz-utils tk-dev libffi-dev liblzma-dev python-openssl
RUN git clone https://github.com/pyenv/pyenv.git ~/.pyenv

ENV PATH /root/.pyenv/bin:$PATH
ENV PATH /root/.pyenv/shims:$PATH

RUN echo 'export PYENV_ROOT="$HOME/.pyenv"' >> .bashrc && \
    echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> .bashrc && \
    echo 'if command -v pyenv 1>/dev/null 2>&1; then\n  eval "$(pyenv init -)"\nfi' >> ~/.bashrc

###################### Install Python
RUN pyenv install 3.6.1 && \
    pyenv global 3.6.1 && \
    python3 -m pip install --upgrade pip setuptools

# Python
# RUN apt-get install -y software-properties-common
# RUN add-apt-repository ppa:deadsnakes/ppa
# RUN apt update
# RUN apt install -y python3.8
# RUN apt-get install -y python3 python3-distutils python3-apt

# dotnet core  https://docs.microsoft.com/en-us/dotnet/core/install/linux-ubuntu#1804-
RUN curl https://packages.microsoft.com/config/ubuntu/18.04/packages-microsoft-prod.deb -o packages-microsoft-prod.deb
RUN dpkg -i packages-microsoft-prod.deb

RUN apt-get install -y apt-transport-https && \
  apt-get update && \
  apt-get install -y dotnet-sdk-5.0

# googleapis/googleapis
WORKDIR /home/bazel-bot
RUN git clone https://github.com/googleapis/googleapis.git
WORKDIR /home/bazel-bot/googleapis


RUN bazel build ...

#!/bin/bash

mkdir -p test-workdir
pushd . 
cd test-workdir
{
    # Clone googleapis
    [ -d "googleapis" ] || git clone https://github.com/googleapis/googleapis

    # Select the sha for HEAD~2
    sha=git -C googleapis log -3 --format=%H | tail -1

    # Create a fake googleapis-gen with the sha tag.
    rm -rf googleapis-gen
    mkdir googleapis-gen
    git -C googleapis-gen init
    echo hello > googleapis-gen/hello.txt
    git -C googleapis-gen add -A
    git -C googleapis-gen commit -m "Hello world."
    git -C googleapis-gen tag "googleapis-$sha"

    # Clone googleapis-gen so git push pushes back to local copy.
    git clone googleapis-gen googleapis-gen-clone

    # Test!
    export GOOGLEAPIS=googleapis
    export GOOGLEAPIS_GEN=googleapis-gen-clone
    export BUILD_TARGETS=//google/cloud/vision/v1:vision-v1-nodejs.tar.gz
    bash ../generate-googleapis-gen.sh
}

popd
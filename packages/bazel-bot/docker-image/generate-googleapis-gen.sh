#!/bin/bash

# Collect the history of googleapis.
git clone https://github.com/googleapis/googleapis
shas=`git -C googleapis log --format=%H`

# Collect shas from googleapis for which we haven't yet generated code in googleapis-gen.
git clone git@github.com:googleapis/googleapis-gen.git
git -C googleapis-gen tag > tags.txt
ungenerated_shas=()
for sha in $shas; do
    if grep $sha tags.txt; then
        # Found a sha we already generated.
        break
    else
        ungenerated_shas+=($sha)
    fi
done

# Iterate over the ungenerated_shas from oldest to newest.
for (( idx=${#ungenerated_shas[@]}-1 ; idx>=0 ; idx-- )) ; do
    sha="${ungenerated_shas[idx]}"

    # Rebuild at the sha.
    git -C googleapis checkout $sha
    (cd googleapis && bazel query 'filter('.*\.tar\.gz$', kind("generated file", //...:*))' \
        | xargs bazel build \
          --remote_cache=https://storage.googleapis.com/surferjeff-test2-bazel-cache \
          --google_default_credentials)
    
    # TODO: Copy the generated source files into googleapis-gen.

    # Commit and push the files to github.
    # Copy the commit message from the commit in googleapis.
    git -C log -1 --format=%s%n%b > commit-msg.txt
    echo "Source-Link: https://github.com/googleapis/googleapis/commit/$sha" >> commit-msg.txt
    git -C googleapis-gen add -A
    git -C googleapis-gen commit -F commit-msg.txt
    git -C googleapis-gen pull --rebase
    git -C googleapis-gen tag "googleapis-$sha"
    git -C googleapis-gen push "googleapis-$sha"
    git -C googleapis-gen push

    # TODO: If something failed, open an issue on github/googleapis-gen.
done






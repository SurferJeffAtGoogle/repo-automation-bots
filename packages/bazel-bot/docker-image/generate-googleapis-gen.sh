#!/bin/bash

# Collect the history of googleapis.
# git clone https://github.com/googleapis/googleapis
ungenerated_shas=(`git -C googleapis log -2 --format=%H`)

# Collect shas from googleapis for which we haven't yet generated code in googleapis-gen.
# git clone git@github.com:googleapis/googleapis-gen.git
# git -C googleapis-gen tag > tags.txt
# ungenerated_shas=()
# for sha in $shas; do
#     if grep $sha tags.txt; then
#         # Found a sha we already generated.
#         break
#     else
#         ungenerated_shas+=($sha)
#     fi
# done

# Iterate over the ungenerated_shas from oldest to newest.
for (( idx=${#ungenerated_shas[@]}-1 ; idx>=0 ; idx-- )) ; do
    sha="${ungenerated_shas[idx]}"

    # Rebuild at the sha.
    git -C googleapis checkout "$sha"
    (cd googleapis && bazel query 'filter('.*\.tar\.gz$', kind("generated file", //...:*))' \
        | xargs bazel build \
          --remote_cache=https://storage.googleapis.com/surferjeff-test2-bazel-cache \
          --google_default_credentials)
    
    # Copy the generated source files into googleapis-gen.
    tars_gzs=$(cd googleapis/bazel-out/k8-fastbuild/bin && find . -name "*.tar.gz")
    for tar_gz in $tars_gzs ; do
        # Strip the .tar.gz to get the relative dir.
        tar="${tar_gz%.*}"
        relative_dir="${tar%.*}"
        # Clear out the existing contents.
        rm -rf "googleapis-gen/$relative_dir"
        # Create the parent directory if it doesn't already exist.
        parent_dir=`dirname $tar_gz`
        target_dir="googleapis-gen/$parent_dir"
        mkdir -p $target_dir
        tar -xf "googleapis/bazel-out/k8-fastbuild/bin/$tar_gz" -C $target_dir
    done

    # Commit and push the files to github.
    # Copy the commit message from the commit in googleapis.
    git -C googleapis log -1 --format=%s%n%b > commit-msg.txt
    echo "Source-Link: https://github.com/googleapis/googleapis/commit/$sha" >> commit-msg.txt

    exit 0;

    git -C googleapis-gen add -A
    git -C googleapis-gen commit -F commit-msg.txt
    git -C googleapis-gen tag "googleapis-$sha"
    git -C googleapis-gen pull
    git -C googleapis-gen push "googleapis-$sha"
    git -C googleapis-gen push

    # TODO: If something failed, open an issue on github/googleapis-gen.
done






# Why did Owl Bot create a pull request on my repo?

Your repository is maintained at least in part by the [GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation) team.

[GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation) uses Owl Bot to automatically generate new source code when a new version of an API's protos are published.

Owl Bot created a pull request because a new version of this library's protos were published.

## What should I do with this pull request?

Merge it immediately after tests pass.

## If I close the pull request, will Owl Bot generate a new one?

No.  Given the same input, Owl Bot always generates the same output.  Therefore, there's no reason and no way to trigger Owl Bot to regenerate the pull request; the new pull request would be exactly the same.

## Can't I wait and merge it tomorrow?

Yes, but there may be pain.  If the API team changes its protos again in the meantime, then Owl Bot will open another pull request and there will be merge conflicts between the two open PRs, so it's best to merge this PR as soon as possible.

### I waited too long, and now there are merge conflicts.

Would you like to preserve the commit history?

* **Yes**:  Merge the pull requests in order, from smallest PR# to largest, and manually resolve conflicts.
* **No**:  Merge the most recent pull request (largest PR#) and close the others.

## Wait, these changes broke the library!

Contact [GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation)
as soon as possible, preferrably via the chat room "GitHub Automation."
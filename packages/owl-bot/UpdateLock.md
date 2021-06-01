# Why did Owl Bot create a pull request on my repo?

Your repository is maintained at least in part by the [GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation) team.

[GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation) uses Owl Bot to automatically update files in your repo.  These may include:

* READMEs
* Configuration files like `.kokoro`, `.gitignore`, etc.
* Dependency configuration files like `requirements.txt`, `package.json`, etc.
* Less commonly, source files like `index.ts`.

Owl Bot created a pull request because a member of [GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation) updated the templates that generate one of the files above.


## What should I do with this pull request?

Merge it immediately after tests pass.

## If I close the pull request, will Owl Bot generate a new one?

No.  Given the same input, Owl Bot always generates the same output.  Therefore, there's no reason and no way to trigger Owl Bot to regenerate the pull request; the new pull request would be exactly the same.


## Can't I wait and merge it tomorrow?

Yes, but there may be pain.  If [GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation) makes another change to the templates in the meantime, then Owl Bot will open another pull request and there will be merge conflicts between the two open PRs, so it's best to merge this PR as soon as possible.

### I waited too long, and now there are merge conflicts.

Would you like to preserve the commit history?

* **Yes**:  Merge the pull requests in order, from smallest PR# to largest, and manually resolve conflicts.
* **No**:  Merge the most recent pull request (largest PR#) and close the others.


## Wait, Owl Bot messed with the file `xyz.pdq`, and I really don't want that.

For most repos and most languages, Owl Bot follows the instructions in `owlbot.py`.  To fix `owlbot.py` in the live pull request:

1.  Checkout out a local copy of the pull request branch.
2.  Revert changes to all files except `.OwlBot.lock.yaml`.
3.  Fix `owlbot.py`, commit changes, and push the commit back up to the branch.
4.  Owl Bot runs again with your changes. 


## Wait, these changes broke the library!

Contact [GitHub Automation](https://github.com/orgs/googleapis/teams/github-automation)
as soon as possible, preferrably via the chat room "GitHub Automation."
#!/usr/bin/env bash
export TS_NODE_PROJECT=tsconfig.test.json
CMD="node -r tsconfig-paths/register node_modules/ava/cli.js"
if [[ -n $AVA_TAP ]]; then
  exec $CMD --tap $@ | $AVA_TAP
else
  exec $CMD $@
fi

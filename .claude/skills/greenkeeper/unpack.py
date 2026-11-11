"""Rebuild a shot file for `npm run check-holes -- calibrate` from the packed string the Greenkeeper's query returns.

The packed string is 'club:power:error:count' groups separated by spaces, with an optional 'course=<id>' first."""
import json
import sys

course = 'westernreserve'
rows = []
for tok in sys.argv[1].split():
    if tok.startswith('course='):
        course = tok.split('=', 1)[1]
        continue
    club, power, err, n = tok.split(':')
    rows += [{'course': course, 'shot': {'c': club, 'p': float(power), 'e': float(err)}}] * int(n)
json.dump(rows, sys.stdout)

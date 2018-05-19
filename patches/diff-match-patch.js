"use strict";

const {diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL} = require("diff-match-patch");

/**
 * Parse a textual representation of patches and return a list of Patch objects.
 * @param {string} textline Text representation of patches.
 * @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
 * @throws {!Error} If invalid input.
 */
diff_match_patch.prototype.patch_fromText = function(textline) {
    const patches = [];
    if (!textline) {
        return patches;
    }
    const text = textline.split("\n");
    let textPointer = 0;
    const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@.*$/;
    let m, patch, sign, line;
    while (textPointer < text.length) {
        m = text[textPointer].match(patchHeader);
        if (!m) {
            throw new Error(`Invalid patch string: ${ text[textPointer] }`);
        }
        patch = new diff_match_patch.patch_obj();
        patches.push(patch);
        patch.start1 = parseInt(m[1], 10);
        if (m[2] === "") {
            patch.start1--;
            patch.length1 = 1;
        } else if (m[2] === "0") {
            patch.length1 = 0;
        } else {
            patch.start1--;
            patch.length1 = parseInt(m[2], 10);
        }

        patch.start2 = parseInt(m[3], 10);
        if (m[4] === "") {
            patch.start2--;
            patch.length2 = 1;
        } else if (m[4] === "0") {
            patch.length2 = 0;
        } else {
            patch.start2--;
            patch.length2 = parseInt(m[4], 10);
        }
        textPointer++;

        while (textPointer < text.length) {
            sign = text[textPointer].charAt(0);
            try {
                line = decodeURI(text[textPointer].slice(1));
            } catch ( ex ) {
                // Malformed URI sequence.
                throw new Error(`Illegal escape in patch_fromText: ${ line }`);
            }
            if (sign === "-") {
                // Deletion.
                patch.diffs.push([DIFF_DELETE, line]);
            } else if (sign === "+") {
                // Insertion.
                patch.diffs.push([DIFF_INSERT, line]);
            } else if (sign === " ") {
                // Minor equality.
                patch.diffs.push([DIFF_EQUAL, line]);
            } else if (sign === "@") {
                // Start of next patch.
                break;
            } else if (sign === "") {
                // Blank line?  Whatever.
            } else {
                // WTF?
                throw new Error(`Invalid patch mode "${ sign }" in: ${ line }`);
            }
            textPointer++;
        }
    }
    return patches;
};

/**
 * Merge a set of patches onto the text.  Return a patched text, as well
 * as a list of true/false values indicating which patches were applied.
 * @param {!Array.<!diff_match_patch.patch_obj>} patches Array of Patch objects.
 * @param {string} text Old text.
 * @return {!Array.<string|!Array.<boolean>>} Two element Array, containing the
 *      new text and an array of boolean values.
 */
diff_match_patch.prototype.patch_addPadding = (patch_addPadding_ => {
    return function patch_addPadding(patches, text) {
        if (this.noPatchPadding) {
            return "";
        }

        return patch_addPadding_.call(this, patches, text);
    };
})(diff_match_patch.prototype.patch_addPadding);

/**
 * loc is a location in text1, compute and return the equivalent location in
 * text2.
 * e.g. 'The cat' vs 'The big cat', 1->1, 5->8
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 * @param {number} loc Location within text1.
 * @return {number} Location within text2.
 */
diff_match_patch.prototype.diff_xIndex = function(diffs, loc) {
    let chars1 = 0;
    let chars2 = 0;
    let last_chars1 = 0;
    let last_chars2 = 0;
    let x;
    for (x = 0; x < diffs.length; x++) {
        if (diffs[x][0] !== DIFF_INSERT) { // Equality or deletion.
            chars1 += diffs[x][1].length;
        }
        if (diffs[x][0] !== DIFF_DELETE) { // Equality or insertion.
            chars2 += diffs[x][1].length;
        }
        if (chars1 > loc) { // Overshot the location.
            break;
        }
        last_chars1 = chars1;
        last_chars2 = chars2;
    }
    // Was the location deleted?
    if (diffs.length !== x && diffs[x][0] === DIFF_DELETE) {
        chars1 = loc - (chars1 - diffs[x][1].length);
        while (chars1 > 0 && ++x < diffs.length && diffs[x][0] === DIFF_INSERT) {
            if (chars1 > diffs[x][1].length) {
                chars2 += diffs[x][1].length;
                chars1 -= diffs[x][1].length;
            } else {
                chars2 += chars1;
                chars1 = 0;
            }
            last_chars2 = chars2;
        }
        return last_chars2;
    }
    // Add the remaining character length.
    return last_chars2 + (loc - last_chars1);
};

/**
 * Locate the best instance of 'pattern' in 'text' near 'loc' using the
 * Bitap algorithm.
 * @param {string} text The text to search.
 * @param {string} pattern The pattern to search for.
 * @param {number} loc The location to search around.
 * @return {number} Best match index or -1.
 * @private
 */
diff_match_patch.prototype.match_bitap_ = function(text, pattern, loc) {
    if (pattern.length > this.Match_MaxBits) {
        throw new Error("Pattern too long for this browser.");
    }

    // Initialise the alphabet.
    const s = this.match_alphabet_(pattern);

    const dmp = this; // 'this' becomes 'window' in a closure.

    /**
     * Compute and return the score for a match with e errors and x location.
     * Accesses loc and pattern through being a closure.
     * @param {number} e Number of errors in match.
     * @param {number} x Location of match.
     * @return {number} Overall score for match (0.0 = good, 1.0 = bad).
     * @private
     */
    function match_bitapScore_(e, x) {
        const accuracy = e / pattern.length;
        const proximity = Math.abs(loc - x);
        if (dmp.Match_Distance < 0) {
            return proximity > -dmp.Match_Distance ? 1.0 : accuracy;
        }
        if (!dmp.Match_Distance) {
            // Dodge divide by zero error.
            return proximity ? 1.0 : accuracy;
        }
        return accuracy + (proximity / dmp.Match_Distance);
    }

    // Highest score beyond which we give up.
    let score_threshold = this.Match_Threshold;
    // Is there a nearby exact match? (speedup)
    let best_loc = text.indexOf(pattern, loc);
    if (best_loc !== -1) {
        score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold);
        // What about in the other direction? (speedup)
        best_loc = text.lastIndexOf(pattern, loc + pattern.length);
        if (best_loc !== -1) {
            score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold);
        }
    }

    // Initialise the bit arrays.
    const matchmask = 1 << (pattern.length - 1);
    best_loc = -1;

    let bin_max = pattern.length + text.length;
    let bin_min, bin_mid, last_rd, start, finish, rd, j, charMatch, score;
    for (let d = 0; d < pattern.length; d++) {
        // Scan for the best match; each iteration allows for one more error.
        // Run a binary search to determine how far from 'loc' we can stray at this
        // error level.
        bin_min = 0;
        bin_mid = bin_max;
        while (bin_min < bin_mid) {
            if (match_bitapScore_(d, loc + bin_mid) <= score_threshold) {
                bin_min = bin_mid;
            } else {
                bin_max = bin_mid;
            }
            bin_mid = Math.floor((bin_max - bin_min) / 2 + bin_min);
        }
        // Use the result from this iteration as the maximum for the next.
        bin_max = bin_mid;
        start = Math.max(1, loc - bin_mid + 1);
        finish = Math.min(loc + bin_mid, text.length) + pattern.length;

        rd = Array(finish + 2);
        rd[finish + 1] = (1 << d) - 1;
        for (j = finish; j >= start; j--) {
            // The alphabet (s) is a sparse hash, so the following line generates
            // warnings.
            charMatch = s[text.charAt(j - 1)];
            if (d === 0) { // First pass: exact match.
                rd[j] = ((rd[j + 1] << 1) | 1) & charMatch;
            } else { // Subsequent passes: fuzzy match.
                rd[j] = (((rd[j + 1] << 1) | 1) & charMatch) |
                (((last_rd[j + 1] | last_rd[j]) << 1) | 1) |
                last_rd[j + 1];
            }
            if (rd[j] & matchmask) {
                score = match_bitapScore_(d, j - 1);
                // This match will almost certainly be better than any existing match.
                // But check anyway.
                if (score <= score_threshold) {
                    // Told you so.
                    score_threshold = score;
                    best_loc = j - 1;
                    if (best_loc > loc) {
                        // When passing loc, don't exceed our current distance from loc.
                        start = Math.max(1, 2 * loc - best_loc);
                    } else {
                        // Already passed loc, downhill from here on in.
                        break;
                    }
                }
            }
        }
        // No hope for a (better) match at greater error levels.
        if (match_bitapScore_(d + 1, loc) > score_threshold) {
            break;
        }
        last_rd = rd;
    }
    return best_loc;
};

module.exports = diff_match_patch;

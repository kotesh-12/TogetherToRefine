
const testRegex = (subject, oldName, newName, cellValue) => {
    const escapedSub = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Current logic used in Allotment.jsx
    const subRegex = new RegExp(escapedSub, 'i');

    // Simulate the replacement logic
    let val = cellValue;
    if (subRegex.test(val)) {
        const tokenRegex = new RegExp(`(${escapedSub})(\\s*\\(.*?\\))?`, 'gi');
        if (newName) {
            val = val.replace(tokenRegex, `$1 (${newName})`);
        } else {
            val = val.replace(tokenRegex, '$1');
        }
    }
    return val;
};

// Test Cases
const cases = [
    { sub: "Maths", newName: "Mary", cell: "Maths", expected: "Maths (Mary)" },
    { sub: "Maths", newName: "Mary", cell: "Maths (John)", expected: "Maths (Mary)" },
    { sub: "Art", newName: "DaVinci", cell: "Smart Art", expected: "Smart Art" }, // Should NOT change Smart Art (part of word)
    { sub: "Art", newName: "DaVinci", cell: "Visual Art", expected: "Visual Art (DaVinci)" }, // Should change (separate word)
    { sub: "C++", newName: "Stroustrup", cell: "C++ Programming", expected: "C++ (Stroustrup) Programming" },
];

cases.forEach((c, i) => {
    const res = testRegex(c.sub, null, c.newName, c.cell);
    console.log(`Test ${i + 1}: [${c.sub}] in [${c.cell}] -> [${res}]`);
    if (res !== c.expected) console.log(`FAIL! Expected: ${c.expected}`);
    else console.log("PASS");
});

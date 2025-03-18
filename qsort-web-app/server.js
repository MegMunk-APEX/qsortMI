const express = require("express");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx"); // ✅ Import XLSX library
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors()); // ✅ Allow frontend requests
app.use(express.static(path.join(__dirname, "public"))); // ✅ Serve static files

// ✅ Define the file path for qsort_details.xlsx
const qsortDetailsFile = path.join(__dirname, "qsort_details.xlsx");

// ✅ Serve index.html for the root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
    next();
});


// ✅ Read Q-sort details from Excel (`qsort_details.xlsx`)
function loadQSortData() {
    const filePath = path.join(__dirname, "qsort_details.xlsx");
    const workbook = xlsx.readFile(filePath);

    // ✅ Extract "Versions" and "Cards" sheets
    const versionsSheet = workbook.Sheets["Versions"];
    const cardsSheet = workbook.Sheets["Cards"];

    if (!versionsSheet || !cardsSheet) {
        console.error("❌ Missing required sheets in Excel file!");
        return { versions: [], cards: {} };
    }

    // ✅ Convert sheets to JSON
    const versions = xlsx.utils.sheet_to_json(versionsSheet);
    const cardsRaw = xlsx.utils.sheet_to_json(cardsSheet);

    // ✅ Organize card data by version
    const cards = {};
    cardsRaw.forEach((row) => {
        if (!cards[row.Version]) {
            cards[row.Version] = [];
        }
        cards[row.Version].push({
            projectName: row["Project Name"],
            mw: row["MW"],
            subRTO: row["RTO"],
            ntp: row["NTP"],
        });
    });

    return { versions: versions.map((v) => v["Version Name"]), cards };
}

// ✅ API to Serve Q-sort Data

// ✅ Get Teams Endpoint (Now Works Correctly)
app.get("/get-teams", (req, res) => {
    try {
        const workbook = xlsx.readFile(qsortDetailsFile); // ✅ Now it's defined!
        const teamsSheet = workbook.Sheets["Teams"];
        if (!teamsSheet) throw new Error("❌ Teams sheet not found in qsort_details.xlsx");

        let teamsData = xlsx.utils.sheet_to_json(teamsSheet, { raw: false });

        // ✅ Ensure "Team Name" column exists
        if (!teamsData.length || !teamsData[0]["Team Name"]) {
            throw new Error("❌ 'Team Name' column missing in Teams sheet");
        }

        // ✅ Extract teams and convert numbers to strings
        let teams = [...new Set(teamsData.map(team => String(team["Team Name"])))];

        console.log("✅ Extracted Teams:", teams);
        res.json({ teams });
    } catch (error) {
        console.error("❌ Error reading Teams sheet:", error);
        res.status(500).json({ error: "Error fetching teams" });
    }
});

// ✅ Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/qsort-data", (req, res) => {
    try {
        const qsortData = loadQSortData();
        res.json(qsortData);
    } catch (error) {
        console.error("❌ Error loading Q-sort data:", error);
        res.status(500).json({ error: "Failed to load Q-sort data" });
    }
});

// ✅ Fetch Cards for a Selected Team
app.get("/get-version-data", (req, res) => {
    const { version, team } = req.query;

    // ✅ Check if required parameters exist
    if (!version || !team) {
        console.error("❌ Bad Request: Missing team or version");
        return res.status(400).json({ error: "Both version and team parameters are required" });
    }

    try {
        const workbook = xlsx.readFile(qsortDetailsFile);
        const cardsSheet = workbook.Sheets["Cards"];
        if (!cardsSheet) throw new Error("❌ Cards sheet not found in qsort_details.xlsx");

        // ✅ Convert sheet to JSON
        let cardsData = xlsx.utils.sheet_to_json(cardsSheet, { raw: false });

        console.log(`✅ Extracted ${cardsData.length} cards from Cards sheet`);

        // ✅ Normalize values before filtering (ensure all strings match)
        const filteredCards = cardsData
            .filter(entry => 
                String(entry["Version"]).trim() === String(version).trim() &&
                String(entry["Team Name"]).trim() === String(team).trim()
            )
            .map(entry => ({
                id: entry["Project Name"], // ✅ Unique identifier
                text: `${entry["Project Name"]} - ${entry["MW"]}MW (${entry["Technology"]})`, // ✅ Summary text
                details: entry // ✅ Send full details to frontend
            }));

        console.log(`✅ Found ${filteredCards.length} cards for version "${version}" and team "${team}"`);

        res.json({ cards: filteredCards });
    } catch (error) {
        console.error("❌ Error reading Cards sheet from qsort_details.xlsx:", error);
        res.status(500).json({ error: "Error fetching version data" });
    }
});



// ✅ Endpoint to Fetch Q-sort Versions (Only Versions with 5+ Projects)
app.get("/get-qsort-details", (req, res) => {
    console.log("✅ /get-qsort-details endpoint was called!");

    try {
        const selectedTeam = req.query.team;
        if (!selectedTeam) {
            return res.status(400).json({ error: "Missing team parameter" });
        }

        const workbook = xlsx.readFile(qsortDetailsFile);
        const versionsSheet = workbook.Sheets["Versions"];
        const cardsSheet = workbook.Sheets["Cards"];

        if (!versionsSheet || !cardsSheet) throw new Error("❌ Missing required sheets in qsort_details.xlsx");

        let versionsData = xlsx.utils.sheet_to_json(versionsSheet, { raw: false });
        let cardsData = xlsx.utils.sheet_to_json(cardsSheet, { raw: false });

        console.log("✅ Extracted Raw Versions Data:", versionsData);

        // ✅ Filter cards by team
        const filteredCards = cardsData.filter(entry => String(entry["Team Name"]) === selectedTeam);
        
        // ✅ Count projects per version
        const versionCounts = filteredCards.reduce((acc, entry) => {
            acc[entry["Version"]] = (acc[entry["Version"]] || 0) + 1;
            return acc;
        }, {});

        console.log("✅ Version Counts:", versionCounts);

        // ✅ Only return versions with 5+ projects
        const versions = Object.entries(versionCounts)
            .filter(([_, count]) => count >= 5)
            .map(([name]) => ({ name }));

        console.log("✅ Processed Versions for Dropdown:", versions);
        res.json({ versions });
    } catch (error) {
        console.error("❌ Error reading Q-sort details:", error);
        res.status(500).json({ error: "Error fetching Q-Sort versions" });
    }
});

// ✅ Endpoint to Submit Q-Sort Results and Save to CSV
app.post("/submit", (req, res) => {
    const { name, version, sortedData } = req.body;

    if (!name || !version || !sortedData || sortedData.length === 0) {
        return res.status(400).json({ success: false, error: "Missing required fields or empty submission" });
    }

    const csvFilePath = "qsort_data.csv";

    // ✅ Determine Submit Number (Count previous submissions for this user & version)
    let submitNumber = 1;
    if (fs.existsSync(csvFilePath)) {
        const fileContent = fs.readFileSync(csvFilePath, "utf8");
        const rows = fileContent.split("\n").filter(row => row.trim() !== ""); // Remove empty lines

        const previousSubmissions = rows.filter(row => {
            const columns = row.split(",");
            return columns[0] === name && columns[1] === version; // Match User + Version
        }).length;

        submitNumber = previousSubmissions + 1;
    }

    // ✅ Extract only the project name for Card Text and save column placement
    const formattedEntries = sortedData.map(entry => {
        let projectName = entry.card.split("-")[0].trim(); // ✅ Extract only the project name
        return `${name},${version},${submitNumber},${entry.column},"${projectName}"`;
    }).join("\n");

    // ✅ Append formatted rows to the CSV
    fs.appendFile(csvFilePath, formattedEntries + "\n", "utf8", (err) => {
        if (err) {
            console.error("❌ Error saving Q-sort submission:", err);
            return res.status(500).json({ success: false, error: "Failed to save submission" });
        }

        console.log("✅ Submission saved successfully:", formattedEntries);
        res.json({ success: true, message: "Submission successful" });
    });
});




// ✅ 1. Define Global Variables
let qsortConfig = {};
let selectedVersion = "";

// ✅ 2. Define Functions (Above `DOMContentLoaded`)

function loadTeams() {
    fetch("http://localhost:3000/get-teams")
        .then(res => res.json())
        .then(data => {
            if (!data.teams) {
                console.error("❌ Backend error:", data.error || "Unknown error");
                return;
            }

            console.log("✅ Fetched teams:", data);

            const teamDropdown = document.getElementById("team-selection");
            if (!teamDropdown) {
                console.error("❌ Error: Team dropdown not found!");
                return;
            }

            teamDropdown.innerHTML = `
                <option value="">Select a Team</option>
                <option value="All Teams - Stage 2">All Teams - Stage 2</option>
                <option value="All Teams - Stage 3">All Teams - Stage 3</option>
            `;

            data.teams.forEach(team => {
                console.log("✅ Adding team:", team);
                const option = document.createElement("option");
                option.value = team;
                option.textContent = `Team ${team}`;
                teamDropdown.appendChild(option);
            });

            console.log("✅ Team dropdown updated:", teamDropdown.innerHTML);
        })
        .catch(err => console.error("❌ Error fetching teams:", err));
}

function loadCards(version, team) {
    console.log(`🔄 loadCards() CALLED for Team ${team} & Version ${version}`);

    fetch(`http://localhost:3000/get-version-data?version=${encodeURIComponent(version)}&team=${encodeURIComponent(team)}`)
        .then(res => res.json())
        .then(data => {
            console.log("✅ Fetched cards:", data);

            // ✅ Ensure `data.cards` is defined
            if (!data || !data.cards || data.cards.length === 0) {
                console.warn(`⚠ No cards found for Team ${team} and Version ${version}.`);
                return;
            }

            // ✅ Clear old cards
            const cardContainer = document.getElementById("card-container");
            cardContainer.innerHTML = "";

            // ✅ Loop through cards and create elements
            data.cards.forEach(card => {
                const cardDiv = document.createElement("div");
                cardDiv.classList.add("card");
                cardDiv.setAttribute("draggable", "true");
                cardDiv.dataset.cardId = card.id;

                // ✅ Display card details
                cardDiv.innerHTML = `
                    <strong>${card.text}</strong><br>
                    <small>${card.details.MW} MW | ${card.details.Technology} | ${card.details["Sub-RTO"]}</small><br>
                `;

                // Attach drag event listeners to the new cards
                cardDiv.addEventListener("dragstart", dragStart);
                cardDiv.addEventListener("dragend", dragEnd);

                cardContainer.appendChild(cardDiv);
            });

            console.log(`✅ Cards loaded successfully. Creating ${data.cards.length} slots...`);

            // ✅ Ensure slots are created AFTER cards are loaded
            createSlots(data.cards.length);

        })
        .catch(err => console.error("❌ Error fetching cards:", err));
}

function resetQSort() {
    document.querySelectorAll(".slot").forEach(slot => {
        while (slot.firstChild) {
            document.getElementById("card-container").appendChild(slot.firstChild);
        }
    });
}

function attachSlotEventListeners() {
    const slots = document.querySelectorAll(".slot");

    slots.forEach(slot => {
        slot.addEventListener("dragover", (event) => {
            event.preventDefault();
            slot.classList.add("highlight-slot");
        });

        slot.addEventListener("dragleave", () => {
            slot.classList.remove("highlight-slot");
        });

        slot.addEventListener("drop", (event) => {
            event.preventDefault();
            slot.classList.remove("highlight-slot");

            const cardId = event.dataTransfer.getData("text/plain");
            const card = document.querySelector(`[data-card-id='${cardId}']`);

            if (card) {
                // If the slot already has a card, move it back to the parking lot
                if (slot.children.length > 0) {
                    const existingCard = slot.firstChild;
                    document.getElementById("card-container").appendChild(existingCard);
                }

                slot.appendChild(card);
                card.style.position = "static"; // Ensures card aligns properly
            }
        });
    });
}

function dragStart(event) {
    event.dataTransfer.setData("text/plain", event.target.dataset.cardId);
    event.target.classList.add("dragging");
}
function dragEnd(event) {
    event.target.classList.remove("dragging");
}

// ✅ Ensure CSV file exists with proper headers
function ensureCSVFileExists() {
    if (!fs.existsSync(qsortDataFile)) {
        console.log("✅ Creating qsort_data.csv file...");
        fs.writeFileSync(qsortDataFile, "Team,Version,User,Sorted Data\n", "utf8");
    }
}

function createSlots(cardCount) {
    const slotContainer = document.getElementById("slot-container");
    if (!slotContainer) {
        console.error("❌ Slot container not found in the DOM.");
        return;
    }

    slotContainer.innerHTML = ""; // ✅ Clear old slots

    let totalSlots = Math.max(cardCount, 1); // ✅ Ensure at least as many slots as cards
    let rowSlots = 1; // ✅ Start with 1 slot in the first row
    let rows = [];

    // ✅ Generate rows following 1, 3, 5, 7 pattern
    while (totalSlots > 0) {
        if (totalSlots - rowSlots >= 0) {
            rows.push(rowSlots);
            totalSlots -= rowSlots;
        } else {
            // ✅ If remaining slots can't form a full row, distribute them to the top row
            rows[rows.length - 1] += totalSlots;
            totalSlots = 0;
        }
        rowSlots += 2; // ✅ Increase row size by next odd number
    }

    console.log(`✅ Generated Pyramid Structure: ${rows}`); // ✅ Debugging output

    // ✅ If slots generated are still fewer than cards, adjust by adding more to the top row
    let totalGeneratedSlots = rows.reduce((sum, num) => sum + num, 0);
    if (totalGeneratedSlots < cardCount) {
        console.error("❌ Not enough slots! Adjusting...");
        rows[0] += (cardCount - totalGeneratedSlots);
    }

    // ✅ Render the slots from bottom to top
    let columnCounter = 1; // Initialize column counter
    rows.reverse().forEach((slotCount, rowIndex) => {
        // Calculate the starting column number for this row
        const startColumn = Math.floor((totalGeneratedSlots - slotCount) / 2) + 1;

        for (let i = 0; i < slotCount; i++) {
            const slot = document.createElement("div");
            slot.classList.add("slot");

            // Assign the column number based on the index in the row
            slot.dataset.column = startColumn + i; // Column numbers start from the calculated start column

            // Set the grid column and row for the slot
            slot.style.gridColumn = startColumn + i;
            slot.style.gridRow = rowIndex + 1;

            slotContainer.appendChild(slot);
        }
    });

    attachSlotEventListeners(); // ✅ Ensure drag & drop works
}

// ✅ 3. DOMContentLoaded Block (Handles Event Listeners)
document.addEventListener("DOMContentLoaded", function () {
    const qsortVersionSelect = document.getElementById("qsort-version");
    const teamSelection = document.getElementById("team-selection");
    const proceedButton = document.getElementById("proceed-btn");
    const cardContainer = document.getElementById("card-container");
    const submitButton = document.getElementById("submit-btn");
    let selectedTeam = "";
    let selectedVersion = "";

    // ✅ Load teams on page load
    fetch("http://localhost:3000/get-teams")
        .then(res => res.json())
        .then(data => {
            console.log("✅ Fetched teams:", data);
            teamSelection.innerHTML = '<option value="">Select a Team</option>';
            data.teams.forEach(team => {
                const option = document.createElement("option");
                option.value = team;
                option.textContent = `Team ${team}`;
                teamSelection.appendChild(option);
                console.log(`✅ Adding team: ${team}`);
            });
            console.log("✅ Team dropdown updated:", teamSelection.innerHTML);
        })
        .catch(err => console.error("❌ Error fetching teams:", err));

    // ✅ Proceed button click event
    proceedButton.addEventListener("click", function () {
        selectedTeam = teamSelection.value.trim();

        if (!selectedTeam) {
            alert("Please select a team before proceeding.");
            return;
        }

        document.getElementById("opening-screen").style.display = "none";
        document.getElementById("qsort-container").style.display = "block";

        console.log(`✅ Proceeding with Team ${selectedTeam}`);
        loadVersions(selectedTeam);
    });

    document.getElementById("qsort-version").addEventListener("change", function () {
        selectedVersion = this.value;
        selectedTeam = document.getElementById("team-selection").value.trim();

        if (!selectedVersion) {
            console.warn("⚠ Please select a Q-sort version.");
            return;
        }

        if (!selectedTeam) {
            console.warn("⚠ No team selected, cannot load cards.");
            return;
        }

        console.log(`✅ Loading cards for Team ${selectedTeam} and Version ${selectedVersion}`);
        loadCards(selectedVersion, selectedTeam); // ✅ Load correct data
    });

    // ✅ Load versions based on the selected team
    function loadVersions(team) {
        fetch(`http://localhost:3000/get-qsort-details?team=${encodeURIComponent(team)}`)
            .then(res => res.json())
            .then(data => {
                console.log("✅ Fetched versions:", data);
                qsortVersionSelect.innerHTML = '<option value="">Select Q-sort Version</option>';
                data.versions.forEach(version => {
                    const option = document.createElement("option");
                    option.value = version.name;
                    option.textContent = version.name;
                    qsortVersionSelect.appendChild(option);
                    console.log(`✅ Adding version: ${version.name}`);
                });
                console.log("✅ Version dropdown updated:", qsortVersionSelect.innerHTML);
            })
            .catch(err => console.error("❌ Error fetching versions:", err));
    }

    // ✅ Handle version selection
    qsortVersionSelect.addEventListener("change", function () {
        selectedVersion = this.value.trim();

        if (!selectedVersion || !selectedTeam) {
            console.warn("⚠ No valid team or version selected.");
            return;
        }

        console.log(`✅ Loading cards for Team ${selectedTeam} and Version ${selectedVersion}`);
        loadCards(selectedVersion, selectedTeam);
    });

    // ✅ Glow Effect: Move OUTSIDE the submit function
    document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", function () {
            // Remove "selected" class from all cards
            document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
            
            // Add "selected" class to clicked card
            this.classList.add("selected");
        });
    });

    // Attach drag event listeners to cards
    document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("dragstart", dragStart);
        card.addEventListener("dragend", dragEnd);
    });

    // Attach slot event listeners
    attachSlotEventListeners();

    // ✅ Submission validation and sending data to backend
    submitButton.addEventListener("click", function () {
        if (!selectedVersion) {
            alert("Please select a Q-sort version before submitting.");
            return;
        }
    
        const userName = prompt("Please enter your name:");
        if (!userName || userName.trim() === "") {
            alert("Name is required for submission.");
            return;
        }
    
        const sortedData = [];
        const slots = document.querySelectorAll(".slot");
    
        slots.forEach(slot => {
            if (slot.children.length > 0) {
                sortedData.push({
                    column: slot.dataset.column,  // ✅ Record the column number
                    card: slot.children[0].textContent.trim() // ✅ Record the card text
                });
            }
        });
    
        const unplacedCards = document.querySelectorAll("#card-container .card").length;
        if (unplacedCards > 0) {
            alert(`You must place all ${unplacedCards} cards before submitting.`);
            return;
        }
    
        const submissionData = {
            name: userName.trim(),
            version: selectedVersion,
            sortedData: sortedData
        };
    
        console.log("📤 Sending submission:", submissionData);  // ✅ Debugging output
    
        fetch("http://localhost:3000/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submissionData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Submission successful!");
                resetQSort();
            } else {
                alert(`Error: ${data.error}`);
            }
        })
        .catch(error => {
            console.error("❌ Error submitting data:", error);
            alert("Failed to submit. Please try again.");
        });
    });

    // ✅ Function to reset Q-sort board after submission
    function resetQSort() {
        document.querySelectorAll(".slot").forEach(slot => {
            while (slot.firstChild) {
                cardContainer.appendChild(slot.firstChild); // ✅ Move cards back to parking lot
            }
        });
    }
});
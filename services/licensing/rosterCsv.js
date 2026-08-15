function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  const pushValue = () => {
    row.push(value.trim());
    value = "";
  };

  const pushRow = () => {
    pushValue();
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
    row = [];
  };

  const input = String(csv || "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      pushValue();
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      pushRow();
    } else {
      value += char;
    }
  }

  if (value !== "" || row.length > 0) {
    pushRow();
  }

  return rows;
}

function parseRosterCsv(csv) {
  const [headerRow, ...dataRows] = parseCsvRows(csv);
  if (!headerRow) return [];

  const headers = headerRow.map((header) =>
    header.replace(/^\uFEFF/, "").trim().toLowerCase(),
  );

  return dataRows.map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return {
      email: row.email || row["email address"] || "",
      studentId:
        row.studentid || row.student_id || row["student id"] || "",
      firstName:
        row.firstname || row.first_name || row["first name"] || "",
      lastName: row.lastname || row.last_name || row["last name"] || "",
      section: row.section || row.group || "",
    };
  });
}

module.exports = { parseCsvRows, parseRosterCsv };

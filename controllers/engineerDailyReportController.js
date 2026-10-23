const mongoose = require("mongoose");

const Project = require("../models/Project");
const DailyWorkReport = require("../models/DailyWorkReport");

const PDFDocument = require("pdfkit");
const https = require("https");

// Return readable labels without depending on a single display-name field.
function getDisplayName(record, fallbacks = []) {
  if (!record) return "Not available";

  for (const field of fallbacks) {
    const value = record[field];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "Not available";
}

// Only include projects managed by the signed-in Engineer.
async function getEngineerProjectIds(engineerId) {
  const projects = await Project.find({
    engineer: engineerId
  }).select("_id");

  return projects.map(project => project._id);
}

function formatReport(report) {
  return {
    ...report,
    workerLabel: getDisplayName(report.worker, [
      "name",
      "fullName",
      "username",
      "email"
    ]),
    projectLabel: getDisplayName(report.project, [
      "name",
      "projectName",
      "title"
    ]),
    taskLabel: getDisplayName(report.task, [
      "title",
      "taskName",
      "name"
    ]),
    reportDateLabel: report.reportDate
      ? new Date(report.reportDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        })
      : "Not available"
  };
}


function downloadCloudinaryPhoto(photoUrl) {
    return new Promise((resolve) => {
        let imageUrl;

        try {
            imageUrl = new URL(photoUrl);
        } catch {
            return resolve(null);
        }

        if (
            imageUrl.protocol !== "https:" ||
            imageUrl.hostname !== "res.cloudinary.com" ||
            !imageUrl.pathname.includes("/image/upload/")
        ) {
            return resolve(null);
        }

        // Ask Cloudinary for JPEG output for PDF compatibility.
        imageUrl.pathname = imageUrl.pathname.replace(
            "/image/upload/",
            "/image/upload/f_jpg/"
        );

        let settled = false;

        const finish = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        const request = https.get(
            imageUrl,
            { timeout: 10000, headers: { Accept: "image/jpeg" } },
            (response) => {
                const contentType = String(
                    response.headers["content-type"] || ""
                )
                    .split(";")[0]
                    .toLowerCase();

                if (
                    response.statusCode !== 200 ||
                    contentType !== "image/jpeg"
                ) {
                    response.resume();
                    finish(null);
                    return;
                }

                const chunks = [];
                let totalBytes = 0;
                const maxBytes = 5 * 1024 * 1024;

                response.on("data", (chunk) => {
                    totalBytes += chunk.length;

                    if (totalBytes > maxBytes) {
                        finish(null);
                        response.destroy();
                        request.destroy();
                        return;
                    }

                    chunks.push(chunk);
                });

                response.on("end", () => {
                    if (totalBytes > 0 && !settled) {
                        finish(Buffer.concat(chunks));
                    } else {
                        finish(null);
                    }
                });

                response.on("error", () => finish(null));
            }
        );

        request.on("timeout", () => {
            request.destroy(new Error("Photo download timed out."));
        });

        request.on("error", () => finish(null));
    });
}


// GET /engineer/daily-reports
async function getEngineerDailyReports(req, res, next) {
  try {
    const projectIds = await getEngineerProjectIds(req.user._id);

    const reports = await DailyWorkReport.find({
      project: { $in: projectIds }
    })
      .populate({
        path: "worker",
        select: "name fullName username email"
      })
      .populate({
        path: "project",
        select: "name projectName title"
      })
      .populate({
        path: "task",
        select: "title taskName name status"
      })
      .sort({
        reportDate: -1,
        createdAt: -1
      })
      .limit(100)
      .lean();

    const formattedReports = reports.map(formatReport);

    return res.render("engineer/daily-reports", {
      user: req.user,
      reports: formattedReports,
      pageTitle: "Daily Progress Reports"
    });
  } catch (error) {
    return next(error);
  }
}

// GET /engineer/daily-reports/:reportId
async function getEngineerDailyReportDetails(req, res, next) {
  try {
    const { reportId } = req.params;

    if (!mongoose.isValidObjectId(reportId)) {
      return res.status(404).send("Daily report not found.");
    }

    const projectIds = await getEngineerProjectIds(req.user._id);

    // Include project authorization in the report query itself.
    // This prevents access to reports belonging to other Engineers.
    const report = await DailyWorkReport.findOne({
      _id: reportId,
      project: { $in: projectIds }
    })
      .populate({
        path: "worker",
        select: "name fullName username email"
      })
      .populate({
        path: "project",
        select: "name projectName title"
      })
      .populate({
        path: "task",
        select: "title taskName name status"
      })
      .lean();

    if (!report) {
      return res.status(404).send("Daily report not found.");
    }

    return res.render("engineer/daily-report-details", {
      user: req.user,
      report: formatReport(report),
      pageTitle: "Daily Report Details"
    });
  } catch (error) {
    return next(error);
  }
}


async function downloadEngineerDailyReportPdf(req, res, next) {
    try {
        const { reportId } = req.params;

        if (!mongoose.isValidObjectId(reportId)) {
            return res.status(404).send("Daily report not found.");
        }

        const projectIds = await getEngineerProjectIds(req.user._id);

        // Enforce engineer ownership in the database query.
        const report = await DailyWorkReport.findOne({
            _id: reportId,
            project: { $in: projectIds }
        })
            .populate({
                path: "worker",
                select: "name fullName username email"
            })
            .populate({
                path: "project",
                select: "name projectName title"
            })
            .populate({
                path: "task",
                select: "title taskName name status"
            })
            .populate({
                path: "reviewedBy",
                select: "name fullName email"
            })
            .lean();

        if (!report) {
            return res.status(404).send("Daily report not found.");
        }

        // Download images before streaming the PDF. Individual image failures
        // should not prevent the report itself from being generated.
        const photoRecords = Array.isArray(report.photos)
            ? report.photos.slice(0, 5)
            : [];

        const downloadedPhotos = await Promise.all(
            photoRecords.map(async (photo) => ({
                photo,
                buffer: await downloadCloudinaryPhoto(photo.url)
            }))
        );

        const embeddedPhotos = downloadedPhotos.filter(
            (item) => item.buffer
        );

        const pdf = new PDFDocument({
            size: "A4",
            margins: {
                top: 45,
                bottom: 45,
                left: 48,
                right: 48
            },
            info: {
                Title: "Daily Progress Report",
                Author: "BuildTrack"
            }
        });

        pdf.on("error", (error) => {
            console.error("Daily report PDF stream error:", error.message);

            if (!res.destroyed) {
                res.destroy(error);
            }
        });

        const fileName = `daily-report-${report._id}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"`
        );

        pdf.pipe(res);

        const usableWidth =
            pdf.page.width -
            pdf.page.margins.left -
            pdf.page.margins.right;

        const formatDate = (value) => {
            if (!value) return "Not available";

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return "Not available";
            }

            return date.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        };

        const displayValue = (value) => {
            if (value === undefined || value === null || value === "") {
                return "—";
            }

            return String(value);
        };

        const addField = (label, value) => {
            pdf.font("Helvetica-Bold")
                .fontSize(10)
                .fillColor("#232323")
                .text(`${label}: `, { continued: true });

            pdf.font("Helvetica")
                .fontSize(10)
                .fillColor("#343434")
                .text(displayValue(value), {
                    width: usableWidth
                });

            pdf.moveDown(0.4);
        };

        const addSection = (title, content) => {
            pdf.moveDown(0.4);

            pdf.font("Helvetica-Bold")
                .fontSize(12)
                .fillColor("#232323")
                .text(title);

            const lineY = pdf.y + 4;

            pdf.moveTo(pdf.page.margins.left, lineY)
                .lineTo(pdf.page.width - pdf.page.margins.right, lineY)
                .lineWidth(1)
                .strokeColor("#D65F47")
                .stroke();

            pdf.moveDown(0.65);

            pdf.font("Helvetica")
                .fontSize(10)
                .fillColor("#343434")
                .text(displayValue(content), {
                    width: usableWidth,
                    lineGap: 2
                });

            pdf.moveDown(0.4);
        };

        // Document heading.
        pdf.font("Helvetica-Bold")
            .fontSize(22)
            .fillColor("#D65F47")
            .text("BuildTrack");

        pdf.moveDown(0.2);

        pdf.font("Helvetica-Bold")
            .fontSize(15)
            .fillColor("#232323")
            .text("Daily Progress Report");

        pdf.moveDown(0.3);

        pdf.font("Helvetica")
            .fontSize(9)
            .fillColor("#666666")
            .text(`Report ID: ${report._id}`);

        pdf.moveDown(0.5);

        pdf.moveTo(pdf.page.margins.left, pdf.y)
            .lineTo(pdf.page.width - pdf.page.margins.right, pdf.y)
            .lineWidth(2)
            .strokeColor("#D65F47")
            .stroke();

        pdf.moveDown(1);

        // Report and project details.
        addField("Project", getDisplayName(report.project, [
            "name", "projectName", "title"
        ]));

        addField("Task", getDisplayName(report.task, [
            "title", "taskName", "name"
        ]));

        addField("Worker", getDisplayName(report.worker, [
            "name", "fullName", "username", "email"
        ]));

        addField("Report date", formatDate(report.reportDate));
        addField("Submitted", formatDate(report.createdAt));
        addField("Status", report.status || "PENDING");
        addField("Labour count", report.labourCount);

        if (report.reviewedAt) {
            addField("Reviewed by", getDisplayName(report.reviewedBy, [
                "name", "fullName", "email"
            ]));

            addField("Reviewed at", formatDate(report.reviewedAt));
        }

        // Work details.
        addSection("Work Performed", report.workPerformed);
        addSection("Materials Used", report.materialsUsed);
        addSection("Site Issues", report.issues);
        addSection("Worker Remarks", report.remarks);

        if (report.reviewRemarks) {
            addSection("Engineer Review Remarks", report.reviewRemarks);
        }

        // Embedded site photographs, arranged in two columns.
        if (photoRecords.length > 0) {
            pdf.moveDown(0.4);

            pdf.font("Helvetica-Bold")
                .fontSize(12)
                .fillColor("#232323")
                .text("Site Photographs");

            pdf.moveDown(0.7);

            if (embeddedPhotos.length === 0) {
                pdf.font("Helvetica")
                    .fontSize(10)
                    .fillColor("#666666")
                    .text(
                        `${photoRecords.length} photo(s) are attached to the report, ` +
                        "but could not be embedded in this PDF."
                    );
            } else {
                const gap = 16;
                const columnWidth = (usableWidth - gap) / 2;
                const imageHeight = 125;
                const rowHeight = 158;

                for (
                    let index = 0;
                    index < embeddedPhotos.length;
                    index += 2
                ) {
                    if (
                        pdf.y + rowHeight >
                        pdf.page.height - pdf.page.margins.bottom
                    ) {
                        pdf.addPage();
                    }

                    const rowY = pdf.y;

                    for (let column = 0; column < 2; column++) {
                        const item = embeddedPhotos[index + column];

                        if (!item) continue;

                        const x =
                            pdf.page.margins.left +
                            column * (columnWidth + gap);

                        try {
                            pdf.image(item.buffer, x, rowY, {
                                fit: [columnWidth, imageHeight],
                                align: "center",
                                valign: "center"
                            });

                            pdf.font("Helvetica")
                                .fontSize(9)
                                .fillColor("#666666")
                                .text(
                                    `Site photograph ${index + column + 1}`,
                                    x,
                                    rowY + imageHeight + 7,
                                    {
                                        width: columnWidth,
                                        align: "center"
                                    }
                                );
                        } catch (imageError) {
                            console.error(
                                "Could not embed a report photograph:",
                                imageError.message
                            );

                            pdf.font("Helvetica")
                                .fontSize(9)
                                .fillColor("#666666")
                                .text(
                                    "This photograph could not be embedded.",
                                    x,
                                    rowY + 10,
                                    { width: columnWidth }
                                );
                        }
                    }

                    pdf.y = rowY + rowHeight;
                }

                if (embeddedPhotos.length < photoRecords.length) {
                    pdf.moveDown(0.4);

                    pdf.font("Helvetica")
                        .fontSize(9)
                        .fillColor("#666666")
                        .text(
                            `${photoRecords.length - embeddedPhotos.length} ` +
                            "photo(s) could not be embedded."
                        );
                }
            }
        } else {
            addSection("Site Photographs", "No photographs were attached.");
        }

        pdf.end();
    } catch (error) {
        return next(error);
    }
}

// POST /engineer/daily-reports/:reportId/review
async function reviewEngineerDailyReport(req, res, next) {
  try {
    const { reportId } = req.params;

    if (!mongoose.isValidObjectId(reportId)) {
      return res.status(404).send("Daily report not found.");
    }

    const reviewRemarks =
      typeof req.body?.reviewRemarks === "string"
        ? req.body.reviewRemarks.trim()
        : "";

    if (reviewRemarks.length > 2000) {
      return res.status(400).send(
        "Review remarks must not exceed 2000 characters."
      );
    }

    // Restrict the review action to this Engineer's projects.
    const projectIds = await getEngineerProjectIds(req.user._id);

    const report = await DailyWorkReport.findOne({
      _id: reportId,
      project: { $in: projectIds }
    })
      .select("_id status")
      .lean();

    if (!report) {
      return res.status(404).send("Daily report not found.");
    }

    if (report.status !== "PENDING") {
      return res.status(409).send(
        "This daily report has already been reviewed."
      );
    }

    // Atomically change only a report that is still PENDING.
    // This prevents two concurrent requests from reviewing it twice.
    const updatedReport = await DailyWorkReport.findOneAndUpdate(
      {
        _id: reportId,
        project: { $in: projectIds },
        status: "PENDING"
      },
      {
        $set: {
          status: "REVIEWED",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          reviewRemarks
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedReport) {
      return res.status(409).send(
        "This report has already been reviewed. Refresh the page."
      );
    }

    return res.redirect(`/engineer/daily-reports/${reportId}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getEngineerDailyReports,
  getEngineerDailyReportDetails,
  downloadEngineerDailyReportPdf,
    reviewEngineerDailyReport
};
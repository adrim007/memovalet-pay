import { exportToGoogleDocs } from "./google-docs";
import { sendGmailMessage } from "./gmail";
import { createTrelloCards } from "./trello";
import { postToSlack } from "./slack";
import { exportToNotion } from "./notion";
import { AttendeeInfo, ExportOptions, ExportResults, MeetingResult } from "../types";

export async function runExports(
  result: MeetingResult,
  options: ExportOptions,
  userId: string,
  attendees: AttendeeInfo[] = []
) {
  const results: ExportResults = {};
  const tasks = [];

  const recordFailure = function (label: string, err: unknown) {
    console.error(label + " export failed", err);
    results.failedExports = [...(results.failedExports || []), label];
  };

  if (options.exportToDocs) {
    tasks.push(
      exportToGoogleDocs(result, userId)
        .then(function (url) {
          results.docsUrl = url;
        })
        .catch(function (err) {
          recordFailure("Google Docs", err);
        })
    );
  }

  if (options.exportToTrello) {
    tasks.push(
      createTrelloCards(result, userId)
        .then(function (cards) {
          results.trelloCards = cards;
        })
        .catch(function (err) {
          recordFailure("Trello", err);
        })
    );
  }

  if (options.exportToSlack) {
    tasks.push(
      postToSlack(result, userId)
        .then(function (posted) {
          results.postedToSlack = posted;
        })
        .catch(function (err) {
          recordFailure("Slack", err);
        })
    );
  }

  if (options.exportToNotion) {
    tasks.push(
      exportToNotion(result, userId)
        .then(function (url) {
          results.notionUrl = url;
        })
        .catch(function (err) {
          recordFailure("Notion", err);
        })
    );
  }

  if (options.emailAttendees) {
    const accepted = attendees.filter(function (a) {
      return a.accepted && a.email;
    });

    tasks.push(
      Promise.all(
        accepted.map(function (a) {
          return sendGmailMessage(result, userId, a.email).catch(function (err) {
            console.error("Failed to email attendee " + a.email, err);
            return null;
          });
        })
      ).then(function (sent) {
        results.attendeesEmailed = sent.filter(function (id) {
          return !!id;
        }).length;
      })
    );
  }

  await Promise.all(tasks);
  return results;
}

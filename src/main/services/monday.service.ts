import { getStore } from '../store';

const MONDAY_API_URL = 'https://api.monday.com/v2';

async function mondayQuery(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const store = getStore();
  const apiKey = store.get('mondayApiKey');
  if (!apiKey) {
    throw new Error('Monday.com API key not configured');
  }

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Monday.com API error: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (result.errors && result.errors.length > 0) {
    throw new Error(`Monday.com GraphQL error: ${result.errors[0].message}`);
  }

  return result.data;
}

export async function testMondayConnection(): Promise<{ name: string }> {
  const data = (await mondayQuery('{ me { name } }')) as { me: { name: string } };
  return { name: data.me.name };
}

export async function getBoards(): Promise<Array<{ id: string; name: string }>> {
  const data = (await mondayQuery('{ boards(limit: 50) { id name } }')) as {
    boards: Array<{ id: string; name: string }>;
  };
  return data.boards;
}

export async function getBoardItems(
  boardId: string
): Promise<
  Array<{
    id: string;
    name: string;
    group: { id: string; title: string };
    columnValues: Array<{ id: string; title: string; text: string; value: string }>;
    subitems: Array<{
      id: string;
      name: string;
      columnValues: Array<{ id: string; title: string; text: string; value: string }>;
    }>;
  }>
> {
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 500) {
          items {
            id
            name
            group { id title }
            column_values {
              id
              title
              text
              value
            }
            subitems {
              id
              name
              column_values {
                id
                title
                text
                value
              }
            }
          }
        }
      }
    }
  `;

  const data = (await mondayQuery(query, { boardId: [boardId] })) as {
    boards: Array<{
      items_page: {
        items: Array<{
          id: string;
          name: string;
          group: { id: string; title: string };
          column_values: Array<{ id: string; title: string; text: string; value: string }>;
          subitems: Array<{
            id: string;
            name: string;
            column_values: Array<{ id: string; title: string; text: string; value: string }>;
          }>;
        }>;
      };
    }>;
  };

  return data.boards[0]?.items_page?.items.map((item) => ({
    id: item.id,
    name: item.name,
    group: item.group,
    columnValues: item.column_values,
    subitems: (item.subitems || []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      columnValues: sub.column_values,
    })),
  })) || [];
}

export async function updateItemColumn(
  boardId: string,
  itemId: string,
  columnId: string,
  value: string
): Promise<void> {
  const query = `
    mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
      change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
        id
      }
    }
  `;
  await mondayQuery(query, { boardId, itemId, columnId, value });
}

export async function getActivityLogs(
  boardId: string,
  since?: string
): Promise<
  Array<{
    id: string;
    event: string;
    data: string;
    createdAt: string;
  }>
> {
  const query = `
    query ($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        activity_logs(limit: 100) {
          id
          event
          data
          created_at
        }
      }
    }
  `;
  const data = (await mondayQuery(query, { boardIds: [boardId] })) as {
    boards: Array<{
      activity_logs: Array<{
        id: string;
        event: string;
        data: string;
        created_at: string;
      }>;
    }>;
  };

  const logs = data.boards[0]?.activity_logs || [];
  const mapped = logs.map((log) => ({
    id: log.id,
    event: log.event,
    data: log.data,
    createdAt: log.created_at,
  }));
  if (since) {
    return mapped.filter((log) => log.createdAt > since);
  }
  return mapped;
}

export function isMondayConfigured(): boolean {
  const store = getStore();
  return !!store.get('mondayApiKey');
}

/**
 * GraphQL API Client
 * Handles all backend communication with credentials (cookies)
 */

const API_URL = window.API_URL || 'http://localhost:3000';

/**
 * Make GraphQL request with credentials (cookies)
 */
async function graphql(query, variables = {}) {
  const response = await fetch(`${API_URL}/api/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apollo-require-preflight': 'true',
    },
    credentials: 'include', // Important: sends cookies
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors[0].message);
  }

  return result.data;
}

/**
 * Update dog
 */
export async function updateDog(id, data) {
  const query = `
    mutation UpdateDog($id: ID!, $data: DogUpdateInput!) {
      updateDog(where: { id: $id }, data: $data) {
        id
        name
        sex
        birthday
        breed
        coat
        owner { id name }
        status
      }
    }
  `;

  return graphql(query, { id, data });
}

/**
 * Create dog
 */
export async function createDog(data) {
  const query = `
    mutation CreateDog($data: DogCreateInput!) {
      createDog(data: $data) {
        id
        name
        status
      }
    }
  `;

  return graphql(query, { data });
}

/**
 * Search owners by name
 */
export async function searchOwners(searchTerm) {
  const query = `
    query SearchOwners($search: String!) {
      owners(
        where: {
          name: { contains: $search, mode: insensitive }
        }
        take: 10
      ) {
        id
        name
        email
        dogs { id }
      }
    }
  `;

  return graphql(query, { search: searchTerm });
}

/**
 * Create owner
 */
export async function createOwner(data) {
  const query = `
    mutation CreateOwner($data: OwnerCreateInput!) {
      createOwner(data: $data) {
        id
        name
      }
    }
  `;

  return graphql(query, { data });
}

/**
 * Update owner
 */
export async function updateOwner(id, data) {
  const query = `
    mutation UpdateOwner($id: ID!, $data: OwnerUpdateInput!) {
      updateOwner(where: { id: $id }, data: $data) {
        id
        name
        email
        phone
      }
    }
  `;

  return graphql(query, { id, data });
}

/**
 * Get moderation mode
 */
export async function getModerationMode() {
  const query = `
    query GetSettings {
      settings {
        moderationMode
      }
    }
  `;

  const data = await graphql(query);
  return data.settings?.moderationMode || 'a_posteriori';
}

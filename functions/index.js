const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
var serviceAccount = require('./serviceAccountKey.json');

// Initialize the app
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://vehicleapp-2f3e5.firebaseio.com',
});

// Main App
const app = express();
app.use(cors({ origin: true }));

// Main database Reference
const db = admin.firestore();

////////////////////////
// Create => post()
////////////////////////

// Create document in specified collection
app.post('/:collectionName', async (req, res) => {
  try {
    const collectionName = req.params.collectionName;
    if (!collectionName) {
      return res.status(400).send({ error: 'Collection name is required' });
    }

    let newDocument = req.body;

    // Store the original name for display purposes
    if (newDocument.name) {
      newDocument.nameDisplay = newDocument.name;
    }

    if (newDocument.make) {
      newDocument.makeDisplay = newDocument.make;
    }

    // Convert all fields to lowercase, except nameDisplay
    Object.keys(newDocument).forEach((key) => {
      if (key !== 'nameDisplay' && key !== 'makeDisplay') {
        newDocument[key] =
          typeof newDocument[key] === 'string'
            ? newDocument[key].toLowerCase()
            : newDocument[key];
      }
    });

    // Let Firestore generate the document ID
    const docRef = await db.collection(collectionName).add(newDocument);

    return res.status(200).send({
      status: 'Success',
      message: `${collectionName} document added`,
      id: docRef.id, // Return the generated document ID
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
});

////////////////////////
// Read => get()
////////////////////////

// Read all
app.get('/:collectionName', async (req, res) => {
  try {
    const collectionName = req.params.collectionName;
    const sortField = req.query.sort; // "sort" for the field to sort by
    const sortOrder = req.query.order; // "order" for the sort direction

    if (!collectionName) {
      return res.status(400).send({ error: 'Collection name is required' });
    }

    let query = db.collection(collectionName);

    // Apply ordering if sort parameters are provided
    if (sortField && sortOrder) {
      query = query.orderBy(sortField, sortOrder === 'desc' ? 'desc' : 'asc');
    }

    const querySnapshot = await query.get();
    let response = [];
    querySnapshot.forEach((doc) => {
      response.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }
});

// Read by id
app.get('/:collectionName/:id', async (req, res) => {
  (async () => {
    try {
      const collectionName = req.params.collectionName;
      if (!collectionName) {
        return res.status(400).send({ error: 'Collection name is required' });
      }
      const documentId = req.params.id;

      const documentRef = db.collection(collectionName).doc(documentId);
      const documentSnapshot = await documentRef.get();

      if (!documentSnapshot.exists) {
        return res.status(404).send({ error: 'Document not found' });
      }

      let response = {
        id: documentSnapshot.id, // Include the document ID in the response
        ...documentSnapshot.data(), // Spread the document data
      };

      return res.status(200).send(response);
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

// Read by field
app.get('/:collectionName/:fieldName/:fieldValue', async (req, res) => {
  try {
    const collectionName = req.params.collectionName;
    if (!collectionName) {
      return res.status(400).send({ error: 'Collection name is required' });
    }
    // Convert fieldName and fieldValue to lowercase
    const fieldName = req.params.fieldName.toLowerCase();
    const fieldValue = req.params.fieldValue.toLowerCase();

    let collection = db.collection(collectionName);
    let response = [];
    await collection
      .where(fieldName, '==', fieldValue)
      .get()
      .then((querySnapshot) => {
        let docs = querySnapshot.docs;
        for (let doc of docs) {
          // Dynamically construct an object with all the fields in the document
          let selectedItem = { id: doc.id, ...doc.data() };
          response.push(selectedItem);
        }
        return response;
      });
    return res.status(200).send(response);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
});

////////////////////////
// Update => patch()
////////////////////////

// Update document in specified collection
app.patch('/:collectionName/:id', async (req, res) => {
  (async () => {
    try {
      const collectionName = req.params.collectionName;
      if (!collectionName) {
        return res.status(400).send({ error: 'Collection name is required' });
      }
      const documentId = req.params.id;

      let updatedDocument = req.body;

      if (updatedDocument.name) {
        updatedDocument.nameDisplay = updatedDocument.name; // Storing lowercase name
      }

      if (updatedDocument.make) {
        updatedDocument.makeDisplay = updatedDocument.make; // Storing lowercase make
      }

      // Convert all fields to lowercase, except nameDisplay
      Object.keys(updatedDocument).forEach((key) => {
        if (key !== 'nameDisplay' && key !== 'makeDisplay') {
          updatedDocument[key] =
            typeof updatedDocument[key] === 'string'
              ? updatedDocument[key].toLowerCase()
              : updatedDocument[key];
        }
      });

      const document = db.collection(collectionName).doc(documentId);
      await document.update(updatedDocument);

      return res.status(200).send({
        status: 'Success',
        message: `${collectionName} document updated`,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

////////////////////////
// Delete => delete()
////////////////////////

// Delete document in specified collection
app.delete('/:collectionName/:id', async (req, res) => {
  (async () => {
    try {
      const collectionName = req.params.collectionName;
      if (!collectionName) {
        return res.status(400).send({ error: 'Collection name is required' });
      }
      const documentId = req.params.id;

      const document = db.collection(collectionName).doc(documentId);
      await document.delete();

      return res.status(200).send({
        status: 'Success',
        message: `${collectionName} document deleted`,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

////////////////////////
// Run Query => post()
////////////////////////

// Main query endpoint
app.post('/:collectionName/query', async (req, res) => {
  try {
    const collectionName = req.params.collectionName;
    const queryData = req.body;
    const results = await processQuery(db, collectionName, queryData);
    return res.status(200).json(results);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error.message);
  }
});

////////////////////////
// FUNCTIONS - QUERY
////////////////////////

// Process the query based on the request parameters
// Main query endpoint
app.post('/:collectionName/query', async (req, res) => {
  try {
    const collectionName = req.params.collectionName;
    const queryData = req.body;
    const results = await processQuery(db, collectionName, queryData);
    return res.status(200).json(results);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error.message);
  }
});

// Process the query based on the request parameters
async function processQuery(db, collectionName, queryData) {
  let allResults = [];
  let query = db.collection(collectionName);

  // Determine the type of filter to apply
  allResults = await applyFilters(db, collectionName, query, queryData);

  // Continue with sorting and pagination
  if (queryData.structuredQuery && queryData.structuredQuery.orderBy) {
    allResults = orderByResults(
      allResults,
      queryData.structuredQuery.orderBy[0]
    );
  }

  if (queryData.pageSize) {
    const { paginatedResults, nextPageToken, currentPage, previousPageToken } =
      paginateResults(allResults, queryData);
    const totalFilteredDocs = allResults.length;
    const pageSize = queryData.pageSize || 3;
    const totalPages = Math.ceil(totalFilteredDocs / pageSize);

    return {
      totalFilteredDocs,
      totalPages,
      currentPage: currentPage,
      documents: paginatedResults,
      nextPageToken: nextPageToken,
      previousPageToken: previousPageToken,
    };
  } else {
    return {
      totalFilteredDocs: allResults.length,
      documents: allResults,
    };
  }
}

// Fetch the results of a Firestore query
async function fetchQueryResults(query) {
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Convert a value object to the Firestore data type
function convertToFirestoreValue(valueObj) {
  if ('stringValue' in valueObj) return valueObj.stringValue;
  if ('integerValue' in valueObj) return parseInt(valueObj.integerValue, 10);
  if ('booleanValue' in valueObj) return valueObj.booleanValue;
  return null; // Add more data types as required
}

function mergeResultsSets(resultsSets) {
  const mergedResults = new Map();
  for (const results of resultsSets) {
    for (const result of results) {
      mergedResults.set(result.id, result); // Assuming 'id' is unique
    }
  }
  return Array.from(mergedResults.values());
}

////////////////////////
// FUNCTIONS - FILTER
////////////////////////

async function applyFilters(db, collectionName, query, queryData) {
  if (queryData.structuredQuery && queryData.structuredQuery.where) {
    if (queryData.structuredQuery.where.compositeFilter) {
      // Apply composite filter
      return await applyCompositeFilter(
        db,
        collectionName,
        queryData.structuredQuery.where.compositeFilter
      );
    } else if (queryData.structuredQuery.where.fieldFilter) {
      // Apply standard field filter or custom filters
      return await applyFieldOrCustomFilter(
        query,
        queryData.structuredQuery.where.fieldFilter
      );
    }
  }
  // If no filter is specified, fetch all results
  return await fetchQueryResults(query);
}

async function applyFieldOrCustomFilter(query, fieldFilter) {
  let allResults = [];

  if (
    [
      '<',
      '<=',
      '==',
      '!=',
      '>',
      '>=',
      'array-contains',
      'in',
      'not-in',
      'array-contains-any',
    ].includes(fieldFilter.op)
  ) {
    // Apply standard field filter
    query = applyFieldFilter(query, fieldFilter);
    allResults = await fetchQueryResults(query);
  } else if (
    fieldFilter.op === 'CONTAINS' ||
    fieldFilter.op === 'STARTS_WITH'
  ) {
    // Apply custom filters after fetching results
    allResults = await fetchQueryResults(query);
    const fieldPath = fieldFilter.field.fieldPath;
    const value = fieldFilter.value.stringValue;

    if (fieldFilter.op === 'CONTAINS') {
      allResults = filterByContains(allResults, fieldPath, value);
    } else if (fieldFilter.op === 'STARTS_WITH') {
      allResults = filterByStartsWith(allResults, fieldPath, value);
    }
  }

  return allResults;
}

// FILTER - Apply a field filter to the Firestore query
function applyFieldFilter(query, filter) {
  const fieldPath = filter.field.fieldPath;
  const operator = filter.op;
  const value = convertToFirestoreValue(filter.value);

  // Standard field filter
  if (
    fieldPath &&
    operator &&
    value !== null &&
    operator !== 'contains' &&
    operator !== 'startsWith'
  ) {
    return query.where(fieldPath, operator, value);
  }

  // For 'contains' and 'startsWith', Firestore doesn't have a direct method.
  // You might need to fetch data and then filter in application code.
  // The following code is just a placeholder and won't work directly with Firestore.
  if (operator === 'contains') {
    // Placeholder: Firestore doesn't support 'contains'.
    // Fetch data and filter in the application.
    return query; // You will need to modify this part.
  }

  if (operator === 'startsWith') {
    // Placeholder: Firestore doesn't support 'startsWith'.
    // Fetch data and filter in the application.
    return query; // You will need to modify this part.
  }

  return query;
}

// Function to apply 'CONTAINS' filter
function filterByContains(results, fieldPath, value) {
  return results.filter(
    (doc) =>
      doc[fieldPath] &&
      doc[fieldPath].toLowerCase().includes(value.toLowerCase())
  );
}

function filterByContainsAnyField(results, value) {
  return results.filter((doc) => {
    console.log('doc', doc);
    return Object.values(doc).some(
      (fieldValue) =>
        typeof fieldValue === 'string' && fieldValue.includes(value)
    );
  });
}

function filterByStartsWith(results, fieldPath, value) {
  return results.filter(
    (doc) => doc[fieldPath] && doc[fieldPath].startsWith(value)
  );
}

function filterByStartsWithAnyField(results, value) {
  return results.filter((doc) => {
    return Object.values(doc).some(
      (fieldValue) =>
        typeof fieldValue === 'string' && fieldValue.startsWith(value)
    );
  });
}

async function applyCompositeFilter(db, collectionName, compositeFilter) {
  const { op, filters } = compositeFilter;

  if (op === 'AND') {
    let query = db.collection(collectionName);
    for (const filter of filters) {
      if (filter.fieldFilter) {
        query = applyFieldFilter(query, filter.fieldFilter);
      }
    }
    return await fetchQueryResults(query);
  } else if (op === 'OR') {
    // Firestore doesn't support 'OR' natively, so fetch results separately and merge them
    const resultsSets = await Promise.all(
      filters.map(async (filter) => {
        if (filter.fieldFilter) {
          const query = applyFieldFilter(
            db.collection(collectionName),
            filter.fieldFilter
          );
          return await fetchQueryResults(query);
        }
        return [];
      })
    );
    return mergeResultsSets(resultsSets);
  }

  return [];
}

////////////////////////
// FUNCTIONS - SORTING & PAGINATION
////////////////////////

// SORTING - Sort the results based on the orderBy clause
function orderByResults(results, orderByClause) {
  const field = orderByClause.field.fieldPath;
  const direction = orderByClause.direction === 'ASCENDING' ? 1 : -1;
  return results.sort((a, b) => {
    if (a[field] < b[field]) return -1 * direction;
    if (a[field] > b[field]) return 1 * direction;
    return 0;
  });
}

// PAGINATION - Apply pagination to the results
function paginateResults(results, queryData) {
  const { pageSize, pageToken } = queryData;

  // Safeguard against empty or invalid results
  if (!Array.isArray(results) || results.length === 0 || !pageSize) {
    return {
      paginatedResults: [],
      nextPageToken: '',
      currentPage: 1,
      previousPageToken: '',
    };
  }

  // Calculate the index to start the page
  let startIndex = pageToken
    ? results.findIndex((item) => item.id === pageToken) + 1
    : 0;

  const endIndex = Math.min(startIndex + pageSize, results.length);

  const paginatedResults = results.slice(startIndex, endIndex);

  // Determine the nextPageToken - the ID of the last item on this page
  let nextPageToken = '';
  if (startIndex + pageSize < results.length) {
    nextPageToken = results[startIndex + pageSize - 1].id;
  }

  // Determine the previousPageToken
  let previousPageToken = '';
  if (startIndex > 0) {
    const previousPageStartIndex = Math.max(0, startIndex - pageSize - 1);
    previousPageToken = results[previousPageStartIndex].id;
  }

  // Calculate the current page number
  const currentPage = Math.ceil((startIndex + 1) / pageSize);

  if (currentPage === 2) {
    previousPageToken = '';
  }

  return {
    paginatedResults,
    nextPageToken,
    currentPage,
    previousPageToken,
  };
}
////////////////////////
// Export API
////////////////////////

// Export the API to Firebase Cloud Functions
exports.app = functions.https.onRequest(app);

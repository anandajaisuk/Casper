import { generatorHandler, GeneratorOptions, DMMF } from '@prisma/generator-helper'
import { logger } from '@prisma/sdk'
import path from 'path'
import fs from 'fs/promises'
import { GENERATOR_NAME } from './constants'

const { version } = require('../package.json')

// Helper function to get relation fields
const getRelationFields = (model: DMMF.Model) => {
  return model.fields.filter(field => field.kind === 'object')
}

// Helper function to identify image/file fields based on field name patterns
const getFileFields = (model: DMMF.Model) => {
  const filePatterns = ['image', 'photo', 'picture', 'avatar', 'file', 'slip', 'attachment']
  return model.fields.filter(field =>
    field.type === 'String' &&
    filePatterns.some(pattern => field.name.toLowerCase().includes(pattern))
  )
}

const generateFileHandler = () => `
async function saveFile(file, folderName) {
    const uploadDir = path.join(process.cwd(), "public", folderName);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const randomId = crypto.randomUUID();
    const fileExtension = path.extname(file.name);
    const newFileName = \`\${randomId}\${fileExtension}\`;
    const filePath = path.join(uploadDir, newFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFileSync(filePath, buffer);

    return \`/\${folderName}/\${newFileName}\`;
}
`

const generateApiRoute = (modelName: string, model: DMMF.Model) => {
  const lowerModel = modelName.toLowerCase()
  const relationFields = getRelationFields(model)
  const fileFields = getFileFields(model)

  const includeObj = relationFields.length > 0
    ? `\n    include: {\n${relationFields.map(field =>
      `      ${field.name}: true`).join(',\n')}\n    }`
    : ''

  const fileImports = fileFields.length > 0 ? `import fs from 'fs'
import crypto from 'crypto'
import path from 'path'` : ''

  const fileHandler = fileFields.length > 0 ? generateFileHandler() : ''

  return `import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
${fileImports}

const prisma = new PrismaClient()
${fileHandler}

export async function GET(req) {
  try {
    const ${lowerModel}s = await prisma.${lowerModel}.findMany({${includeObj}
    })
    return NextResponse.json(${lowerModel}s)
  } catch (error) {
    console.error('Failed to fetch ${lowerModel}s:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ${lowerModel}s' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    ${fileFields.length > 0 ? `const formData = await req.formData();
    
    // Process file uploads
    const data = {};
    ${fileFields.map(field => `
    const ${field.name}File = formData.get("${field.name}");
    if (${field.name}File && ${field.name}File.name) {
        data.${field.name} = await saveFile(${field.name}File, "${lowerModel}${field.name}s");
    }`).join('\n')}
    
    // Process other fields
    for (const [key, value] of formData.entries()) {
      if (!${fileFields.map(f => `key.startsWith("${f.name}")`).join(' && ')}) {
        try {
          // Try to parse JSON fields
          data[key] = JSON.parse(value);
        } catch {
          // If not JSON, use the value as is
          data[key] = value;
        }
      }
    }` :
      'const data = await req.json()'}

    const new${modelName} = await prisma.${lowerModel}.create({
      data,
      include: {${relationFields.map(field => `\n        ${field.name}: true`).join(',')}
      }
    })
    return NextResponse.json(new${modelName}, { status: 201 })
  } catch (error) {
    console.error('Failed to create ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to create ${lowerModel}', details: error.message },
      { status: 500 }
    )
  }
}`
}

const generateSlugApiRoute = (modelName: string, model: DMMF.Model) => {
  const lowerModel = modelName.toLowerCase()
  const relationFields = getRelationFields(model)
  const fileFields = getFileFields(model)

  const includeObj = relationFields.length > 0
    ? `\n    include: {\n${relationFields.map(field =>
      `      ${field.name}: true`).join(',\n')}\n    }`
    : ''

  const fileImports = fileFields.length > 0 ? `import fs from 'fs'
import crypto from 'crypto'
import path from 'path'` : ''

  const fileHandler = fileFields.length > 0 ? generateFileHandler() : ''

  return `import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
${fileImports}

const prisma = new PrismaClient()
${fileHandler}

export async function GET(req, { params }) {
  try {
    const { id } = await params
    const ${lowerModel} = await prisma.${lowerModel}.findUnique({
      where: { id: parseInt(id) },${includeObj}
    })
   
    if (!${lowerModel}) {
      return NextResponse.json(
        { error: '${modelName} not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(${lowerModel})
  } catch (error) {
    console.error('Failed to fetch ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ${lowerModel}' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params
    
    const existing${modelName} = await prisma.${lowerModel}.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existing${modelName}) {
      return NextResponse.json(
        { error: '${modelName} not found' },
        { status: 404 }
      )
    }

    ${fileFields.length > 0 ? `
    // Check content type to determine if it's form data
    const contentType = req.headers.get('content-type') || '';
    
    let data;
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      data = {};

      // Process file uploads
      ${fileFields.map(field => `
      const ${field.name}File = formData.get("${field.name}");
      if (${field.name}File && ${field.name}File.name) {
        // Delete old file if it exists
        if (existing${modelName}.${field.name}) {
          const oldFilePath = path.join(process.cwd(), "public", existing${modelName}.${field.name});
          try {
            await fs.unlinkSync(oldFilePath);
          } catch (error) {
            console.error('Failed to delete old file:', error);
          }
        }
        data.${field.name} = await saveFile(${field.name}File, "${lowerModel}${field.name}s");
      }`).join('\n')}
      
      // Process other fields
      for (const [key, value] of formData.entries()) {
        if (!${fileFields.map(f => `key.startsWith("${f.name}")`).join(' && ')}) {
          try {
            // Try to parse JSON fields
            data[key] = JSON.parse(value);
          } catch {
            // If not JSON, use the value as is
            data[key] = value;
          }
        }
      }
    } else {
      data = await req.json();
    }` : 'const data = await req.json()'}
   
    const updated${modelName} = await prisma.${lowerModel}.update({
      where: { id: parseInt(id) },
      data,
      include: {${relationFields.map(field => `\n        ${field.name}: true`).join(',')}
      }
    })
   
    return NextResponse.json(updated${modelName})
  } catch (error) {
    console.error('Failed to update ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to update ${lowerModel}', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existing${modelName} = await prisma.${lowerModel}.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existing${modelName}) {
      return NextResponse.json(
        { error: '${modelName} not found' },
        { status: 404 }
      )
    }
   
    ${fileFields.length > 0 ? `
    // Delete associated files
    ${fileFields.map(field => `
    if (existing${modelName}.${field.name}) {
      const filePath = path.join(process.cwd(), "public", existing${modelName}.${field.name});
      try {
        await fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }`).join('\n')}` : ''}

    await prisma.${lowerModel}.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: '${modelName} deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to delete ${lowerModel}', details: error.message },
      { status: 500 }
    )
  }
}`
}

generatorHandler({
  onManifest() {
    logger.info(`${GENERATOR_NAME}: Registered`)
    return {
      version,
      defaultOutput: '../api',
      prettyName: GENERATOR_NAME,
    }
  },

  onGenerate: async (options: GeneratorOptions) => {
    try {
      const outputDir = options.generator.output?.value || '';
      await fs.mkdir(outputDir, { recursive: true })

      // Generate combined API documentation
      const combinedDocs = generateCombinedApiDocs(options.dmmf.datamodel.models);
      await fs.writeFile(path.join(outputDir, 'docs.html'), combinedDocs, 'utf-8');

      for (const model of options.dmmf.datamodel.models) {
        const folderPath = path.join(outputDir, model.name.toLowerCase())
        const slugFolderPath = path.join(folderPath, '[id]')

        // Create folders
        await fs.mkdir(folderPath, { recursive: true })
        await fs.mkdir(slugFolderPath, { recursive: true })

        // Generate API routes
        const indexContent = generateApiRoute(model.name, model)
        const slugContent = generateSlugApiRoute(model.name, model)

        await fs.writeFile(path.join(folderPath, 'route.js'), indexContent, 'utf-8')
        await fs.writeFile(path.join(slugFolderPath, 'route.js'), slugContent, 'utf-8')

        // Generate testing documentation
        const postmanCollection = generatePostmanCollection(model.name, model)

        // Write testing documentation
        await fs.writeFile(
          path.join(folderPath, 'postman-collection.json'),
          JSON.stringify(postmanCollection, null, 2),
          'utf-8'
        )


        logger.info(`Generated API routes and testing docs for model: ${model.name}`)
      }
    } catch (error) {
      logger.error('Failed to generate API routes:', error)
      throw error
    }
  },
})

const generateCurlCommand = (method: string, endpoint: any, hasFileFields: any) => {
  if (hasFileFields) {
    return `curl -X ${method} '${endpoint}' \\
  -H 'Content-Type: multipart/form-data' \\
  -F 'field1=value1' \\
  -F 'file=@/path/to/file'`;
  }

  return `curl -X ${method} '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  ${method !== 'DELETE' ? "-d '{\n  \"field\": \"value\"\n}'" : ''}`;
};

const generateRequestDataDocs = (model: any) => {
  const fileFields = getFileFields(model);
  const hasFileFields = fileFields.length > 0;
  const regularFields = model.fields.filter((f: DMMF.Field) =>
    !f.isGenerated &&
    !fileFields.includes(f)
  );

  const exampleData = Object.fromEntries(
    regularFields.map((f: { name: any; kind: string; type: string }) => [
      f.name,
      f.kind === 'object'
        ? { connect: { id: 1 } }
        : f.type === 'String'
          ? 'example'
          : f.type === 'Int'
            ? 1
            : f.type === 'Boolean'
              ? true
              : null
    ])
  );

  return `
    <div class="mb-4">
      <h4 class="text-lg font-semibold mb-2">Request Data Structure</h4>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <h5 class="font-medium mb-2">Field</h5>
          ${regularFields.map((f: { name: any }) => `
            <div class="py-1">${f.name}</div>
          `).join('')}
          ${fileFields.map(f => `
            <div class="py-1">${f.name}</div>
          `).join('')}
        </div>
        <div>
          <h5 class="font-medium mb-2">Type</h5>
          ${regularFields.map((f: { kind: string; type: any }) => `
            <div class="py-1">${f.kind === 'object' ? 'Relation' : f.type}</div>
          `).join('')}
          ${fileFields.map(f => `
            <div class="py-1">File</div>
          `).join('')}
        </div>
        <div>
          <h5 class="font-medium mb-2">Required</h5>
          ${regularFields.map((f: { isRequired: any }) => `
            <div class="py-1">${f.isRequired ? 'Yes' : 'No'}</div>
          `).join('')}
          ${fileFields.map(f => `
            <div class="py-1">No</div>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="mb-4">
      <h4 class="text-lg font-semibold mb-2">Example Request</h4>
      ${hasFileFields ? `
        <p class="text-sm mb-2">Content-Type: multipart/form-data</p>
        <pre><code class="language-javascript">// FormData structure
const formData = new FormData();
${fileFields.map(f => `formData.append('${f.name}', file); // File object`).join('\n')}
${regularFields.map((f: { name: string | number; kind: string }) => `formData.append('${f.name}', ${f.kind === 'object'
    ? `JSON.stringify({ connect: { id: 1 } })`
    : typeof exampleData[f.name] === 'string'
      ? `'${exampleData[f.name]}'`
      : exampleData[f.name]
    });`).join('\n')}</code></pre>
      ` : `
        <p class="text-sm mb-2">Content-Type: application/json</p>
        <pre><code class="language-javascript">${JSON.stringify(exampleData, null, 2)}</code></pre>
      `}
    </div>
  `;
};


const generateCombinedApiDocs = (models: any) => {
  const modelDocs = models.map((model: DMMF.Model) => {
    const hasFileFields = getFileFields(model).length > 0;

    return `
    <div id="${model.name.toLowerCase()}" class="mb-16 scroll-mt-24">
      <h2 class="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">${model.name} API</h2>
      
      ${generateRequestDataDocs(model)}

      <div class="grid gap-8">
        <!-- GET All -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-2xl font-semibold mb-4 text-gray-800">Get All ${model.name}s</h3>
          <div class="space-y-4">
            <div>
              <h4 class="text-md font-medium mb-2">cURL</h4>
              <pre><code class="language-bash">${generateCurlCommand('GET', `/api/${model.name.toLowerCase()}`, false)}</code></pre>
            </div>
            <div>
              <h4 class="text-md font-medium mb-2">Axios</h4>
              <pre><code class="language-javascript">const getAll${model.name}s = async () => {
    try {
        const response = await axios.get('/api/${model.name.toLowerCase()}');
        return response.data;
    } catch (error) {
        throw error;
    }
};</code></pre>
            </div>
          </div>
        </div>

        <!-- GET By ID -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-2xl font-semibold mb-4 text-gray-800">Get ${model.name} by ID</h3>
          <div class="space-y-4">
            <div>
              <h4 class="text-md font-medium mb-2">cURL</h4>
              <pre><code class="language-bash">${generateCurlCommand('GET', `/api/${model.name.toLowerCase()}/1`, false)}</code></pre>
            </div>
            <div>
              <h4 class="text-md font-medium mb-2">Axios</h4>
              <pre><code class="language-javascript">const get${model.name}ById = async (id) => {
    try {
        const response = await axios.get(\`/api/${model.name.toLowerCase()}/\${id}\`);
        return response.data;
    } catch (error) {
        throw error;
    }
};</code></pre>
            </div>
          </div>
        </div>

        <!-- POST -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-2xl font-semibold mb-4 text-gray-800">Create ${model.name}</h3>
          <div class="space-y-4">
            <div>
              <h4 class="text-md font-medium mb-2">cURL</h4>
              <pre><code class="language-bash">${generateCurlCommand('POST', `/api/${model.name.toLowerCase()}`, hasFileFields)}</code></pre>
            </div>
            <div>
              <h4 class="text-md font-medium mb-2">Axios</h4>
              <pre><code class="language-javascript">const create${model.name} = async (data) => {
    try {
        const formData = new FormData();
        if (data.files) {
            for (const [key, file] of Object.entries(data.files)) {
                formData.append(key, file);
            }
        }
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'files') {
                formData.append(key, typeof value === 'object' ? 
                    JSON.stringify(value) : value);
            }
        }
        const response = await axios.post('/api/${model.name.toLowerCase()}', formData);
        return response.data;
    } catch (error) {
        throw error;
    }
};</code></pre>
            </div>
          </div>
        </div>

        <!-- PUT -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-2xl font-semibold mb-4 text-gray-800">Update ${model.name}</h3>
          <div class="space-y-4">
            <div>
              <h4 class="text-md font-medium mb-2">cURL</h4>
              <pre><code class="language-bash">${generateCurlCommand('PUT', `/api/${model.name.toLowerCase()}/1`, hasFileFields)}</code></pre>
            </div>
            <div>
              <h4 class="text-md font-medium mb-2">Axios</h4>
              <pre><code class="language-javascript">const update${model.name} = async (id, data) => {
    try {
        const formData = new FormData();
        if (data.files) {
            for (const [key, file] of Object.entries(data.files)) {
                formData.append(key, file);
            }
        }
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'files') {
                formData.append(key, typeof value === 'object' ? 
                    JSON.stringify(value) : value);
            }
        }
        const response = await axios.put(\`/api/${model.name.toLowerCase()}/\${id}\`, formData);
        return response.data;
    } catch (error) {
        throw error;
    }
};</code></pre>
            </div>
          </div>
        </div>

        <!-- DELETE -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-2xl font-semibold mb-4 text-gray-800">Delete ${model.name}</h3>
          <div class="space-y-4">
            <div>
              <h4 class="text-md font-medium mb-2">cURL</h4>
              <pre><code class="language-bash">${generateCurlCommand('DELETE', `/api/${model.name.toLowerCase()}/1`, false)}</code></pre>
            </div>
            <div>
              <h4 class="text-md font-medium mb-2">Axios</h4>
              <pre><code class="language-javascript">const delete${model.name} = async (id) => {
    try {
        const response = await axios.delete(\`/api/${model.name.toLowerCase()}/\${id}\`);
        return response.data;
    } catch (error) {
        throw error;
    }
};</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  `}).join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Documentation</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <nav class="bg-white shadow-md fixed w-full z-10">
        <div class="container mx-auto px-4">
            <div class="flex justify-between items-center py-4">
                <h1 class="text-2xl font-bold">API Documentation</h1>
                <div class="flex gap-4">
                ${models.map((model: { name: string }) => `
                    <a href="#${model.name.toLowerCase()}" 
                       class="text-gray-600 hover:text-gray-900 hover:underline">${model.name}</a>
                `).join('')}
                </div>
            </div>
        </div>
    </nav>
    
    <div class="container mx-auto px-4 py-8 pt-24">
        ${modelDocs}
    </div>

    <script>
        hljs.highlightAll();
    </script>
</body>
</html>`;
};


// Helper to generate Postman collection for a model
const generatePostmanCollection = (modelName: string, model: DMMF.Model) => {
  const lowerModel = modelName.toLowerCase()
  const baseUrl = "http://localhost:3000"
  const fileFields = getFileFields(model)
  const hasFileFields = fileFields.length > 0

  return {
    info: {
      name: `${modelName} API`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [
      {
        name: "Get All",
        request: {
          method: "GET",
          url: {
            raw: `${baseUrl}/api/${lowerModel}`
          }
        }
      },
      {
        name: "Get By Id",
        request: {
          method: "GET",
          url: {
            raw: `${baseUrl}/api/${lowerModel}/1`
          }
        }
      },
      {
        name: "Create",
        request: {
          method: "POST",
          url: {
            raw: `${baseUrl}/api/${lowerModel}`
          },
          header: hasFileFields ? [] : [
            {
              key: "Content-Type",
              value: "application/json"
            }
          ],
          body: hasFileFields ? {
            mode: "formdata",
            formdata: [
              ...fileFields.map(field => ({
                key: field.name,
                type: "file",
                src: []
              })),
              ...model.fields
                .filter(f => !f.isGenerated && !fileFields.includes(f))
                .map(f => ({
                  key: f.name,
                  type: "text",
                  value: f.kind === 'object'
                    ? JSON.stringify({ connect: { id: 1 } })
                    : f.type === 'String'
                      ? 'example'
                      : f.type === 'Int'
                        ? '1'
                        : f.type === 'Boolean'
                          ? 'true'
                          : 'value'
                }))
            ]
          } : {
            mode: "raw",
            raw: JSON.stringify(
              Object.fromEntries(
                model.fields
                  .filter(f => !f.isGenerated)
                  .map(f => [
                    f.name,
                    f.kind === 'object'
                      ? { connect: { id: 1 } }
                      : f.type === 'String'
                        ? 'example'
                        : f.type === 'Int'
                          ? 1
                          : f.type === 'Boolean'
                            ? true
                            : 'value'
                  ])
              ),
              null,
              2
            )
          }
        }
      },
      {
        name: "Update",
        request: {
          method: "PUT",
          url: {
            raw: `${baseUrl}/api/${lowerModel}/1`
          },
          header: hasFileFields ? [] : [
            {
              key: "Content-Type",
              value: "application/json"
            }
          ],
          body: hasFileFields ? {
            mode: "formdata",
            formdata: [
              ...fileFields.map(field => ({
                key: field.name,
                type: "file",
                src: []
              })),
              ...model.fields
                .filter(f => !f.isGenerated && !fileFields.includes(f))
                .map(f => ({
                  key: f.name,
                  type: "text",
                  value: f.kind === 'object'
                    ? JSON.stringify({ connect: { id: 1 } })
                    : f.type === 'String'
                      ? 'updated example'
                      : f.type === 'Int'
                        ? '2'
                        : f.type === 'Boolean'
                          ? 'false'
                          : 'updated value'
                }))
            ]
          } : {
            mode: "raw",
            raw: JSON.stringify(
              Object.fromEntries(
                model.fields
                  .filter(f => !f.isGenerated)
                  .map(f => [
                    f.name,
                    f.kind === 'object'
                      ? { connect: { id: 1 } }
                      : f.type === 'String'
                        ? 'updated example'
                        : f.type === 'Int'
                          ? 2
                          : f.type === 'Boolean'
                            ? false
                            : 'updated value'
                  ])
              ),
              null,
              2
            )
          }
        }
      },
      {
        name: "Delete",
        request: {
          method: "DELETE",
          url: {
            raw: `${baseUrl}/api/${lowerModel}/1`
          }
        }
      }
    ]
  }
}
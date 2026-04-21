

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    fileType: "STL" | "OBJ" | "UNKNOWN";
    fileSize: number;
    volume?: number;
    surfaceArea?: number;
  };
}

export class FileValidationService {
  private static MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static ALLOWED_EXTENSIONS = [".stl", ".obj"];

  /**
   * Validate uploaded 3D file for structure, safety, and metadata.
   */
  public async validateFile(
    fileBuffer: Uint8Array,
    originalName: string,
    fileSize: number
  ): Promise<ValidationReport> {
    const report: ValidationReport = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        fileType: "UNKNOWN",
        fileSize,
      },
    };

    // 1. Basic checks
    if (fileSize > FileValidationService.MAX_FILE_SIZE) {
      report.isValid = false;
      report.errors.push(`File is too large. Max size is 50MB.`);
    }

    const lowerName = originalName.toLowerCase();
    const ext = FileValidationService.ALLOWED_EXTENSIONS.find((e) =>
      lowerName.endsWith(e)
    );
    if (!ext) {
      report.isValid = false;
      report.errors.push(`Invalid extension. Allowed: .stl, .obj`);
      return report;
    }

    report.metadata!.fileType = ext === ".stl" ? "STL" : "OBJ";

    // 2. Malware & Structure check via magic numbers/header parsing
    try {
      if (report.metadata!.fileType === "STL") {
        this.validateSTLStructure(fileBuffer, report);
      } else if (report.metadata!.fileType === "OBJ") {
        this.validateOBJStructure(fileBuffer, report);
      }
    } catch (e: any) {
      report.isValid = false;
      report.errors.push(`Failed to read or parse file: ${e.message}`);
    }

    if (report.errors.length > 0) report.isValid = false;

    return report;
  }

  /**
   * Validates STL file integrity and identifies whether it is ASCII or Binary.
   */
  private validateSTLStructure(buffer: Uint8Array, report: ValidationReport) {
    if (buffer.length < 84) {
      report.isValid = false;
      report.errors.push("STL file is too small to be valid.");
      return;
    }

    // Heuristics to check binary vs ascii
    // ASCII STLs usually start with 'solid '
    const headerString = new TextDecoder("ascii").decode(buffer.subarray(0, 6)).toLowerCase();
    const isAscii = headerString.startsWith("solid ");

    if (isAscii) {
      // Basic check for ASCII STL ending
      const lastBytesArray = buffer.subarray(Math.max(0, buffer.length - 200));
      const lastBytes = new TextDecoder("ascii").decode(lastBytesArray).toLowerCase();
      if (!lastBytes.includes("endsolid")) {
        report.warnings.push(
          "ASCII STL might be truncated. Could not consistently find 'endsolid' near EOF."
        );
      }
      // Binary STL Check
      // Standard Binary STL has 80 bytes header, then 4 bytes integer (number of triangles)
      const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const numTriangles = dataView.getUint32(80, true);
      const expectedSize = 84 + numTriangles * 50;

      if (buffer.length !== expectedSize) {
        report.errors.push(
          `Binary STL corrupted. Expected size ${expectedSize} bytes based on ${numTriangles} triangles, but got ${buffer.length} bytes.`
        );
      }
    }
  }

  /**
   * Validates OBJ files
   */
  private validateOBJStructure(buffer: Uint8Array, report: ValidationReport) {
    // OBJ files are plain text.
    // Basic malware check: ensure file doesn't contain null bytes (which a raw text file shouldn't have)
    const MAX_PEEK = Math.min(1024, buffer.length);
    for (let i = 0; i < MAX_PEEK; i++) {
      if (buffer[i] === 0x00) {
        report.isValid = false;
        report.errors.push(
          "OBJ file appears to be a binary file, which violates the OBJ text structure."
        );
        return;
      }
    }

    // Basic heuristic: should have 'v ' (vertex) or '#' (comment)
    const content = new TextDecoder("ascii").decode(buffer.subarray(0, MAX_PEEK));
    if (!content.includes("v ") && !content.includes("#")) {
      report.warnings.push(
        "OBJ file lacks standard vertex ('v ') or comment ('#') definitions in header."
      );
    }
  }
}

export const fileValidationService = new FileValidationService();

export default `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 2) in vec2 uv;

uniform mat4 viewMat;
uniform mat4 projMat;
uniform mat4 worldMat;

out vec3 _normal;
out vec3 _tangent;
out vec3 _bitangent;
out vec2 _uv;

void main()
{
  _pos = vec3(worldMat * vec4(position, 1.0f));
  _normal = normalize(mat3(worldMat) * normal);
  _tangent = normalize(mat3(worldMat) * tangent.rgb);
  _bitangent = cross(_normal, _tangent) * tangent.w;
  _uv = vec2(uv.x, 1.0f - uv.y);

  gl_Position = projMat * viewMat * worldMat * vec4(position, 1.0f);
}
`;